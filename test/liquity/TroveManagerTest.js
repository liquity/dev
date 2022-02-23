const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const VSTTokenTester = artifacts.require("./VSTTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 * 
 */
contract('TroveManager', async accounts => {
  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

  const multisig = accounts[999]

  let priceFeed
  let VSTToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let stabilityPoolERC20
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let vestaParameters
  let hintHelpers
  let erc20

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const getNetBorrowingAmount = async (debtWithFee, asset) => th.getNetBorrowingAmount(contracts, debtWithFee, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const withdrawVST = async (params) => th.withdrawVST(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.vstToken = await VSTTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address
    )
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

    priceFeed = contracts.priceFeedTestnet
    VSTToken = contracts.vstToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    vestaParameters = contracts.vestaParameters;

    vstaStaking = VSTAContracts.vstaStaking
    vstaToken = VSTAContracts.vstaToken
    communityIssuance = VSTAContracts.communityIssuance

    await vstaToken.unprotectedMint(multisig, dec(1, 24))

    erc20 = contracts.erc20;

    let index = 0;
    for (const acc of accounts) {
      await vstaToken.approve(vstaStaking.address, await web3.eth.getBalance(acc), { from: acc })
      await erc20.mint(acc, await web3.eth.getBalance(acc))
      index++;

      if (index >= 20)
        break;
    }

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)

    stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
    stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
  })

  it('liquidate(): closes a Trove that has ICR < MCR', async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })

    const price = await priceFeed.getPrice()
    const ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    assert.equal(ICR_Before, dec(4, 18))

    const ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    assert.equal(ICR_Before_Asset, dec(4, 18))

    assert.equal((await vestaParameters.MCR(ZERO_ADDRESS)).toString(), '1100000000000000000')
    assert.equal((await vestaParameters.MCR(erc20.address)).toString(), '1100000000000000000')

    // Alice increases debt to 180 VST, lowering her ICR to 1.11
    await getNetBorrowingAmount(dec(130, 18))
    await getNetBorrowingAmount(dec(130, 18), erc20.address)

    const targetICR = toBN('1111111111111111111')
    await withdrawVST({ ICR: targetICR, extraParams: { from: alice } })
    await withdrawVST({ asset: erc20.address, ICR: targetICR, extraParams: { from: alice } })

    const ICR_AfterWithdrawal = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_AfterWithdrawal_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, targetICR), 100)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal_Asset, targetICR), 100)

    // price drops to 1ETH:100VST, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // close Trove
    await troveManager.liquidate(ZERO_ADDRESS, alice, { from: owner });
    await troveManager.liquidate(erc20.address, alice, { from: owner });

    // check the Trove is successfully closed, and removed from sortedList
    const status = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const status_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX]
    assert.equal(status, 3)  // status enum 3 corresponds to "Closed by liquidation"
    assert.equal(status_Asset, 3)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
  })

  it("liquidate(): decreases ActivePool ETH and VSTDebt by correct amounts", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    const { collateral: A_collateral_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check ActivePool ETH and VST debt before
    const activePool_ETH_Before = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePooL_VSTDebt_Before = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()

    const activePool_ETH_Before_Asset = (await activePool.getAssetBalance(erc20.address)).toString()
    const activePool_RawEther_Before_Asset = (await erc20.balanceOf(activePool.address)).toString()
    const activePooL_VSTDebt_Before_Asset = (await activePool.getVSTDebt(erc20.address)).toString()

    assert.equal(activePool_ETH_Before, A_collateral.add(B_collateral))
    assert.equal(activePool_RawEther_Before, A_collateral.add(B_collateral))
    th.assertIsApproximatelyEqual(activePooL_VSTDebt_Before, A_totalDebt.add(B_totalDebt))

    assert.equal(activePool_ETH_Before_Asset, A_collateral_Asset.add(B_collateral_Asset))
    assert.equal(activePool_RawEther_Before_Asset, A_collateral_Asset.add(B_collateral_Asset).div(toBN(10 ** 10)))
    th.assertIsApproximatelyEqual(activePooL_VSTDebt_Before_Asset, A_totalDebt_Asset.add(B_totalDebt_Asset))

    // price drops to 1ETH:100VST, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    /* close Bob's Trove. Should liquidate his ether and VST,
    leaving Alice’s ether and VST debt in the ActivePool. */
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner });
    await troveManager.liquidate(erc20.address, bob, { from: owner });

    // check ActivePool ETH and VST debt
    const activePool_ETH_After = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePooL_VSTDebt_After = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()

    const activePool_ETH_After_Asset = (await activePool.getAssetBalance(erc20.address)).toString()
    const activePool_RawEther_After_Asset = (await erc20.balanceOf(activePool.address)).toString()
    const activePooL_VSTDebt_After_Asset = (await activePool.getVSTDebt(erc20.address)).toString()

    assert.equal(activePool_ETH_After, A_collateral)
    assert.equal(activePool_RawEther_After, A_collateral)
    th.assertIsApproximatelyEqual(activePooL_VSTDebt_After, A_totalDebt)

    assert.equal(activePool_ETH_After_Asset, A_collateral_Asset)
    assert.equal(activePool_RawEther_After_Asset, A_collateral_Asset.div(toBN(10 ** 10)))
    th.assertIsApproximatelyEqual(activePooL_VSTDebt_After_Asset, A_totalDebt_Asset)
  })

  it("liquidate(): increases DefaultPool ETH and VST debt by correct amounts", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check DefaultPool ETH and VST debt before
    const defaultPool_ETH_Before = (await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const defaultPool_RawEther_Before = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPooL_VSTDebt_Before = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()

    const defaultPool_ETH_Before_Asset = (await defaultPool.getAssetBalance(erc20.address))
    const defaultPool_RawEther_Before_Asset = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPooL_VSTDebt_Before_Asset = (await defaultPool.getVSTDebt(erc20.address)).toString()

    assert.equal(defaultPool_ETH_Before, '0')
    assert.equal(defaultPool_RawEther_Before, '0')
    assert.equal(defaultPooL_VSTDebt_Before, '0')

    assert.equal(defaultPool_ETH_Before_Asset, '0')
    assert.equal(defaultPool_RawEther_Before_Asset, '0')
    assert.equal(defaultPooL_VSTDebt_Before_Asset, '0')

    // price drops to 1ETH:100VST, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // close Bob's Trove
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner });
    await troveManager.liquidate(erc20.address, bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPooL_VSTDebt_After = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()

    const defaultPool_ETH_After_Asset = (await defaultPool.getAssetBalance(erc20.address)).toString()
    const defaultPool_RawEther_After_Asset = (await erc20.balanceOf(defaultPool.address)).toString()
    const defaultPooL_VSTDebt_After_Asset = (await defaultPool.getVSTDebt(erc20.address)).toString()

    const defaultPool_ETH = th.applyLiquidationFee(B_collateral)
    assert.equal(defaultPool_ETH_After, defaultPool_ETH)
    assert.equal(defaultPool_RawEther_After, defaultPool_ETH)
    th.assertIsApproximatelyEqual(defaultPooL_VSTDebt_After, B_totalDebt)

    const defaultPool_ETH_Asset = th.applyLiquidationFee(B_collateral_Asset)
    assert.equal(defaultPool_ETH_After_Asset, defaultPool_ETH_Asset)
    assert.equal(defaultPool_RawEther_After_Asset, defaultPool_ETH_Asset.div(toBN(10 ** 10)))
    th.assertIsApproximatelyEqual(defaultPooL_VSTDebt_After_Asset, B_totalDebt_Asset)
  })

  it("liquidate(): removes the Trove's stake from the total stakes", async () => {
    // --- SETUP ---
    const { collateral: A_collateral } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    const { collateral: A_collateral_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await troveManager.totalStakes(ZERO_ADDRESS)).toString()
    const totalStakes_Before_Asset = (await troveManager.totalStakes(erc20.address)).toString()
    assert.equal(totalStakes_Before, A_collateral.add(B_collateral))
    assert.equal(totalStakes_Before_Asset, A_collateral_Asset.add(B_collateral_Asset))

    // price drops to 1ETH:100VST, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Close Bob's Trove
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner });
    await troveManager.liquidate(erc20.address, bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await troveManager.totalStakes(ZERO_ADDRESS)).toString()
    const totalStakes_After_Asset = (await troveManager.totalStakes(erc20.address)).toString()
    assert.equal(totalStakes_After, A_collateral)
    assert.equal(totalStakes_After_Asset, A_collateral_Asset)
  })

  it("liquidate(): Removes the correct trove from the TroveOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(216, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // At this stage, TroveOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(dec(100, 18))

    const arrayLength_Before = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const arrayLength_Before_Asset = await troveManager.getTroveOwnersCount(erc20.address)
    assert.equal(arrayLength_Before, 6)
    assert.equal(arrayLength_Before_Asset, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate carol
    await troveManager.liquidate(ZERO_ADDRESS, carol)
    await troveManager.liquidate(erc20.address, carol)

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const arrayLength_After_Asset = await troveManager.getTroveOwnersCount(erc20.address)
    assert.equal(arrayLength_After, 5)
    assert.equal(arrayLength_After_Asset, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final TroveOwners array should be:

    [W, A, B, E, D] 

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await troveManager.TroveOwners(ZERO_ADDRESS, 0)
    const trove_1 = await troveManager.TroveOwners(ZERO_ADDRESS, 1)
    const trove_2 = await troveManager.TroveOwners(ZERO_ADDRESS, 2)
    const trove_3 = await troveManager.TroveOwners(ZERO_ADDRESS, 3)
    const trove_4 = await troveManager.TroveOwners(ZERO_ADDRESS, 4)

    const trove_0_Asset = await troveManager.TroveOwners(erc20.address, 0)
    const trove_1_Asset = await troveManager.TroveOwners(erc20.address, 1)
    const trove_2_Asset = await troveManager.TroveOwners(erc20.address, 2)
    const trove_3_Asset = await troveManager.TroveOwners(erc20.address, 3)
    const trove_4_Asset = await troveManager.TroveOwners(erc20.address, 4)

    assert.equal(trove_0, whale)
    assert.equal(trove_1, alice)
    assert.equal(trove_2, bob)
    assert.equal(trove_3, erin)
    assert.equal(trove_4, dennis)

    assert.equal(trove_0_Asset, whale)
    assert.equal(trove_1_Asset, alice)
    assert.equal(trove_2_Asset, bob)
    assert.equal(trove_3_Asset, erin)
    assert.equal(trove_4_Asset, dennis)

    // Check correct indices recorded on the active trove structs
    const whale_arrayIndex = (await troveManager.Troves(whale, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX]
    const alice_arrayIndex = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX]
    const bob_arrayIndex = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX]
    const dennis_arrayIndex = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX]
    const erin_arrayIndex = (await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX]

    const whale_arrayIndex_Asset = (await troveManager.Troves(whale, erc20.address))[th.TROVE_ARRAY_INDEX]
    const alice_arrayIndex_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_ARRAY_INDEX]
    const bob_arrayIndex_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_ARRAY_INDEX]
    const dennis_arrayIndex_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_ARRAY_INDEX]
    const erin_arrayIndex_Asset = (await troveManager.Troves(erin, erc20.address))[th.TROVE_ARRAY_INDEX]

    // [W, A, B, E, D] 
    assert.equal(whale_arrayIndex, 0)
    assert.equal(alice_arrayIndex, 1)
    assert.equal(bob_arrayIndex, 2)
    assert.equal(erin_arrayIndex, 3)
    assert.equal(dennis_arrayIndex, 4)

    assert.equal(whale_arrayIndex_Asset, 0)
    assert.equal(alice_arrayIndex_Asset, 1)
    assert.equal(bob_arrayIndex_Asset, 2)
    assert.equal(erin_arrayIndex_Asset, 3)
    assert.equal(dennis_arrayIndex_Asset, 4)
  })

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    const { collateral: A_collateral } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    const { collateral: A_collateral_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_Before = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()
    const totalStakesSnapshot_Before_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_Before_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')
    assert.equal(totalStakesSnapshot_Before_Asset, '0')
    assert.equal(totalCollateralSnapshot_Before_Asset, '0')

    // price drops to 1ETH:100VST, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // close Bob's Trove.  His ether*0.995 and VST should be added to the DefaultPool.
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner });
    await troveManager.liquidate(erc20.address, bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system: 
    10 ether, Alice's stake.

    Total collateral should be equal to Alice's collateral plus her pending ETH reward (Bob’s collaterale*0.995 ether), earned
    from the liquidation of Bob's Trove */
    const totalStakesSnapshot_After = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()
    const totalStakesSnapshot_After_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_After_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnapshot_After, A_collateral)
    assert.equal(totalCollateralSnapshot_After, A_collateral.add(th.applyLiquidationFee(B_collateral)))
    assert.equal(totalStakesSnapshot_After_Asset, A_collateral_Asset)
    assert.equal(totalCollateralSnapshot_After_Asset, A_collateral_Asset.add(th.applyLiquidationFee(B_collateral_Asset)))
  })

  it("liquidate(): updates the L_ETH and L_VSTDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(111, 16)), extraParams: { from: carol } })

    const { collateral: A_collateral_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    const { collateral: C_collateral_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(111, 16)), extraParams: { from: carol } })

    // --- TEST ---

    // price drops to 1ETH:100VST, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // close Carol's Trove.  
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    await troveManager.liquidate(ZERO_ADDRESS, carol, { from: owner });
    await troveManager.liquidate(erc20.address, carol, { from: owner });
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Carol's ether*0.995 and VST should be added to the DefaultPool.
    const L_ETH_AfterCarolLiquidated = await troveManager.L_ASSETS(ZERO_ADDRESS)
    const L_VSTDebt_AfterCarolLiquidated = await troveManager.L_VSTDebts(ZERO_ADDRESS)
    const L_ETH_AfterCarolLiquidated_Asset = await troveManager.L_ASSETS(erc20.address)
    const L_VSTDebt_AfterCarolLiquidated_Asset = await troveManager.L_VSTDebts(erc20.address)

    const L_ETH_expected_1 = th.applyLiquidationFee(C_collateral).mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    const L_VSTDebt_expected_1 = C_totalDebt.mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    const L_ETH_expected_1_Asset = th.applyLiquidationFee(C_collateral_Asset).mul(mv._1e18BN).div(A_collateral_Asset.add(B_collateral_Asset))
    const L_VSTDebt_expected_1_Asset = C_totalDebt_Asset.mul(mv._1e18BN).div(A_collateral_Asset.add(B_collateral_Asset))
    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, L_ETH_expected_1), 100)
    assert.isAtMost(th.getDifference(L_VSTDebt_AfterCarolLiquidated, L_VSTDebt_expected_1), 100)
    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated_Asset, L_ETH_expected_1_Asset), 100)
    assert.isAtMost(th.getDifference(L_VSTDebt_AfterCarolLiquidated_Asset, L_VSTDebt_expected_1_Asset), 100)

    // Bob now withdraws VST, bringing his ICR to 1.11
    const { increasedTotalDebt: B_increasedTotalDebt } = await withdrawVST({ ICR: toBN(dec(111, 16)), extraParams: { from: bob } })
    const { increasedTotalDebt: B_increasedTotalDebt_Asset } = await withdrawVST({ asset: erc20.address, ICR: toBN(dec(111, 16)), extraParams: { from: bob } })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // price drops to 1ETH:50VST, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    await priceFeed.getPrice()

    // close Bob's Trove 
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner });
    await troveManager.liquidate(erc20.address, bob, { from: owner });
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.

   Bob's pending collateral reward and debt reward are applied to his Trove
   before his liquidation.
   His total collateral*0.995 and debt are then added to the DefaultPool. 

   The system rewards-per-unit-staked should now be:

   L_ETH = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 ETH
   L_VSTDebt = (180 / 20) + (890 / 10) = 98 VST */
    const L_ETH_AfterBobLiquidated = await troveManager.L_ASSETS(ZERO_ADDRESS)
    const L_VSTDebt_AfterBobLiquidated = await troveManager.L_VSTDebts(ZERO_ADDRESS)

    const L_ETH_expected_2 = L_ETH_expected_1.add(th.applyLiquidationFee(B_collateral.add(B_collateral.mul(L_ETH_expected_1).div(mv._1e18BN))).mul(mv._1e18BN).div(A_collateral))
    const L_VSTDebt_expected_2 = L_VSTDebt_expected_1.add(B_totalDebt.add(B_increasedTotalDebt).add(B_collateral.mul(L_VSTDebt_expected_1).div(mv._1e18BN)).mul(mv._1e18BN).div(A_collateral))
    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, L_ETH_expected_2), 100)
    assert.isAtMost(th.getDifference(L_VSTDebt_AfterBobLiquidated, L_VSTDebt_expected_2), 100)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: bob, value: dec(100, 'ether') } })
    await openTrove({ asset: erc20.address, assetSent: dec(100, 'ether'), ICR: toBN(dec(200, 18)), extraParams: { from: bob } })

    // Alice creates a single trove with 0.7 ETH and a debt of 70 VST, and provides 10 VST to SP
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

    // Alice proves 10 VST to SP
    await stabilityPool.provideToSP(dec(10, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(10, 18), { from: alice })

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    const alice_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
    const alice_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')
    assert.equal(alice_ICR_Asset, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const activeTrovesCount_Before_Asset = await troveManager.getTroveOwnersCount(erc20.address)

    assert.equal(activeTrovesCount_Before, 2)
    assert.equal(activeTrovesCount_Before_Asset, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

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

  it("liquidate(): reverts if trove is non-existent", async () => {
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 0) // check trove non-existent
    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 0) // check trove non-existent

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    try {
      const txCarol = await troveManager.liquidate(ZERO_ADDRESS, carol)
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    try {
      const txCarol = await troveManager.liquidate(erc20.address, carol)
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(ZERO_ADDRESS, carol)
    const txCarol_L1_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txCarol_L1.receipt.status)
    assert.isTrue(txCarol_L1_Asset.receipt.status)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 3)  // check trove closed by liquidation
    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 3)  // check trove closed by liquidation

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    try {
      const txCarol_L2 = await troveManager.liquidate(ZERO_ADDRESS, carol)
      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    try {
      const txCarol_L2 = await troveManager.liquidate(erc20.address, carol)
      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_Before_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    const price = await priceFeed.getPrice()

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR_Asset.gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Attempt to liquidate bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob), "TroveManager: nothing to liquidate")

    // Check bob active, check whale active
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, whale)))
    assert.isTrue((await sortedTroves.contains(erc20.address, bob)))
    assert.isTrue((await sortedTroves.contains(erc20.address, whale)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()
    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_After_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
    assert.equal(TCR_Before_Asset, TCR_After_Asset)
    assert.equal(listSize_Before_Asset, listSize_After_Asset)
  })

  it("liquidate(): Given the same price and no other trove changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides VST to SP
    const spDeposit = toBN(dec(100, 24))
    await openTrove({ ICR: toBN(dec(4, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: whale })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    // Price drop
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // All defaulters liquidated
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
    await troveManager.liquidate(erc20.address, defaulter_2)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_3)
    await troveManager.liquidate(erc20.address, defaulter_3)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_4)
    await troveManager.liquidate(erc20.address, defaulter_4)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR_Before, TCR_After)
    assert.equal(TCR_Before_Asset, TCR_After_Asset)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides VST to SP
    const spDeposit = toBN(dec(100, 24))
    await openTrove({ ICR: toBN(dec(4, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })

    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: whale })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_1 = await th.getTCR(contracts)
    const TCR_1_Asset = await th.getTCR(contracts, erc20.address)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Check TCR improves with each liquidation that is offset with Pool
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))
    const TCR_2 = await th.getTCR(contracts)
    const TCR_2_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_2.gte(TCR_1))
    assert.isTrue(TCR_2_Asset.gte(TCR_1_Asset))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
    await troveManager.liquidate(erc20.address, defaulter_2)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))
    const TCR_3 = await th.getTCR(contracts)
    const TCR_3_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_3.gte(TCR_2))
    assert.isTrue(TCR_3_Asset.gte(TCR_2_Asset))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_3)
    await troveManager.liquidate(erc20.address, defaulter_3)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))
    const TCR_4 = await th.getTCR(contracts)
    const TCR_4_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_4.gte(TCR_3))
    assert.isTrue(TCR_4_Asset.gte(TCR_3_Asset))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_4)
    await troveManager.liquidate(erc20.address, defaulter_4)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))
    const TCR_5 = await th.getTCR(contracts)
    const TCR_5_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_5.gte(TCR_4))
    assert.isTrue(TCR_5_Asset.gte(TCR_4_Asset))
  })

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_0 = await th.getTCR(contracts)
    const TCR_0_Asset = await th.getTCR(contracts, erc20.address)

    const entireSystemCollBefore = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)

    const entireSystemCollBefore_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtBefore_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    const expectedTCR_0 = entireSystemCollBefore.mul(price).div(entireSystemDebtBefore)
    const expectedTCR_0_Asset = entireSystemCollBefore_Asset.mul(price).div(entireSystemDebtBefore_Asset)

    assert.isTrue(expectedTCR_0.eq(TCR_0))
    assert.isTrue(expectedTCR_0_Asset.eq(TCR_0_Asset))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Check TCR does not decrease with each liquidation 
    const liquidationTx_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    const liquidationTx_1_Asset = await troveManager.liquidate(erc20.address, defaulter_1)
    const [liquidatedDebt_1, liquidatedColl_1, gasComp_1] = th.getEmittedLiquidationValues(liquidationTx_1)
    const [liquidatedDebt_1_Asset, liquidatedColl_1_Asset, gasComp_1_Asset] = th.getEmittedLiquidationValues(liquidationTx_1_Asset)

    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))
    const TCR_1 = await th.getTCR(contracts)
    const TCR_1_Asset = await th.getTCR(contracts, erc20.address)

    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = (entireSystemCollBefore
      .sub(gasComp_1))
      .mul(price)
      .div(entireSystemDebtBefore)

    const expectedTCR_1_Asset = (entireSystemCollBefore_Asset
      .sub(gasComp_1_Asset))
      .mul(price)
      .div(entireSystemDebtBefore_Asset)

    assert.isTrue(expectedTCR_1.eq(TCR_1))
    assert.isTrue(expectedTCR_1_Asset.eq(TCR_1_Asset))

    const liquidationTx_2 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
    const liquidationTx_2_Asset = await troveManager.liquidate(erc20.address, defaulter_2)
    const [liquidatedDebt_2, liquidatedColl_2, gasComp_2] = th.getEmittedLiquidationValues(liquidationTx_2)
    const [liquidatedDebt_2_Asset, liquidatedColl_2_Asset, gasComp_2_Asset] = th.getEmittedLiquidationValues(liquidationTx_2_Asset)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))

    const TCR_2 = await th.getTCR(contracts)
    const TCR_2_Asset = await th.getTCR(contracts, erc20.address)

    const expectedTCR_2 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2))
      .mul(price)
      .div(entireSystemDebtBefore)

    const expectedTCR_2_Asset = (entireSystemCollBefore_Asset
      .sub(gasComp_1_Asset)
      .sub(gasComp_2_Asset))
      .mul(price)
      .div(entireSystemDebtBefore_Asset)

    assert.isTrue(expectedTCR_2.eq(TCR_2))
    assert.isTrue(expectedTCR_2_Asset.eq(TCR_2_Asset))

    const liquidationTx_3 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_3)
    const liquidationTx_3_Asset = await troveManager.liquidate(erc20.address, defaulter_3)
    const [liquidatedDebt_3, liquidatedColl_3, gasComp_3] = th.getEmittedLiquidationValues(liquidationTx_3)
    const [liquidatedDebt_3_Asset, liquidatedColl_3_Asset, gasComp_3_Asset] = th.getEmittedLiquidationValues(liquidationTx_3_Asset)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))

    const TCR_3 = await th.getTCR(contracts)
    const TCR_3_Asset = await th.getTCR(contracts, erc20.address)

    const expectedTCR_3 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3))
      .mul(price)
      .div(entireSystemDebtBefore)

    const expectedTCR_3_Asset = (entireSystemCollBefore_Asset
      .sub(gasComp_1_Asset)
      .sub(gasComp_2_Asset)
      .sub(gasComp_3_Asset))
      .mul(price)
      .div(entireSystemDebtBefore_Asset)

    assert.isTrue(expectedTCR_3.eq(TCR_3))
    assert.isTrue(expectedTCR_3_Asset.eq(TCR_3_Asset))

    const liquidationTx_4 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_4)
    const liquidationTx_4_Asset = await troveManager.liquidate(erc20.address, defaulter_4)
    const [liquidatedDebt_4, liquidatedColl_4, gasComp_4] = th.getEmittedLiquidationValues(liquidationTx_4)
    const [liquidatedDebt_4_Asset, liquidatedColl_4_Asset, gasComp_4_Asset] = th.getEmittedLiquidationValues(liquidationTx_4_Asset)
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    const TCR_4 = await th.getTCR(contracts)
    const TCR_4_Asset = await th.getTCR(contracts, erc20.address)

    const expectedTCR_4 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .sub(gasComp_4))
      .mul(price)
      .div(entireSystemDebtBefore)

    const expectedTCR_4_Asset = (entireSystemCollBefore_Asset
      .sub(gasComp_1_Asset)
      .sub(gasComp_2_Asset)
      .sub(gasComp_3_Asset)
      .sub(gasComp_4_Asset))
      .mul(price)
      .div(entireSystemDebtBefore_Asset)

    assert.isTrue(expectedTCR_4.eq(TCR_4))
    assert.isTrue(expectedTCR_4_Asset.eq(TCR_4_Asset))
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: spDeposit, extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: spDeposit, extraParams: { from: bob } })

    await openTrove({ ICR: toBN(dec(218, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Bob sends tokens to Dennis, who has no trove
    await VSTToken.transfer(dennis, spDeposit.mul(toBN(2)), { from: bob })

    //Dennis provides VST to SP
    await stabilityPool.provideToSP(spDeposit, { from: dennis })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))

    const liquidationTX_C = await troveManager.liquidate(ZERO_ADDRESS, carol)
    const liquidationTX_C_Asset = await troveManager.liquidate(erc20.address, carol)
    const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTX_C)
    const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTX_C_Asset)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(dennis)).toString()
    const dennis_Deposit_Before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_Before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, liquidatedColl), 1000)
    assert.isAtMost(th.getDifference(dennis_Deposit_Before_Asset, spDeposit.sub(liquidatedDebt_Asset)), 1000000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before_Asset, liquidatedColl_Asset.div(toBN(10 ** 10))), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Attempt to liquidate Dennis
    try {
      const txDennis = await troveManager.liquidate(ZERO_ADDRESS, dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    try {
      const txDennis = await troveManager.liquidate(erc20.address, dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorAssetGain(dennis)).toString()

    const dennis_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()

    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)

    assert.equal(dennis_Deposit_Before_Asset, dennis_Deposit_After_Asset)
    assert.equal(dennis_ETHGain_Before_Asset, dennis_ETHGain_After_Asset)
  })

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: spDeposit, extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(218, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: spDeposit, extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides VST to SP
    await stabilityPool.provideToSP(spDeposit, { from: bob })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await troveManager.liquidate(ZERO_ADDRESS, carol)
    const liquidationTX_C_Asset = await troveManager.liquidate(erc20.address, carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)
    const [liquidatedDebt_Asset, liquidatedColl_Asset, gasComp_Asset] = th.getEmittedLiquidationValues(liquidationTX_C_Asset)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gt(mv._MCR))

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(bob)).toString()

    const bob_Deposit_Before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
    const bob_ETHGain_Before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

    assert.isAtMost(th.getDifference(bob_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, liquidatedColl), 1000)

    assert.isAtMost(th.getDifference(bob_Deposit_Before_Asset, spDeposit.sub(liquidatedDebt_Asset)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before_Asset, liquidatedColl_Asset.div(toBN(10 ** 10))), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Attempt to liquidate Bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob), "TroveManager: nothing to liquidate")

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorAssetGain(bob)).toString()

    const bob_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
    const bob_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After)

    assert.equal(bob_Deposit_Before_Asset, bob_Deposit_After_Asset)
    assert.equal(bob_ETHGain_Before_Asset, bob_ETHGain_After_Asset)
  })

  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    const A_spDeposit = toBN(dec(3, 24))
    const B_spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(8, 18)), extraVSTAmount: A_spDeposit, extraParams: { from: alice } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraVSTAmount: A_spDeposit, extraParams: { from: alice } })

    const { collateral: B_collateral, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(218, 16)), extraVSTAmount: B_spDeposit, extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(210, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    const { collateral: B_collateral_Asset, totalDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraVSTAmount: B_spDeposit, extraParams: { from: bob } })
    const { collateral: C_collateral_Asset, totalDebt: C_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides VST to SP
    await stabilityPool.provideToSP(B_spDeposit, { from: bob })
    await stabilityPoolERC20.provideToSP(B_spDeposit, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(ZERO_ADDRESS, carol)
    await troveManager.liquidate(erc20.address, carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(bob)
    const bob_ETHGain_Before = await stabilityPool.getDepositorAssetGain(bob)

    const bob_Deposit_Before_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)
    const bob_ETHGain_Before_Asset = await stabilityPoolERC20.getDepositorAssetGain(bob)

    assert.isAtMost(th.getDifference(bob_Deposit_Before, B_spDeposit.sub(C_debt)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, th.applyLiquidationFee(C_collateral)), 1000)

    assert.isAtMost(th.getDifference(bob_Deposit_Before_Asset, B_spDeposit.sub(C_debt_Asset)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before_Asset, th.applyLiquidationFee(C_collateral_Asset).div(toBN(10 ** 10))), 1000)

    // Alice provides VST to SP
    await stabilityPool.provideToSP(A_spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(A_spDeposit, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob)
    await troveManager.liquidate(erc20.address, bob)

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    const bob_Trove_Status = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]).toString()
    const bob_Trove_Status_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]).toString()
    assert.equal(bob_Trove_Status, 3)
    assert.equal(bob_Trove_Status_Asset, 3)

    /* Alice's VST Loss = (300 / 400) * 200 = 150 VST
       Alice's ETH gain = (300 / 400) * 2*0.995 = 1.4925 ETH

       Bob's VSTLoss = (100 / 400) * 200 = 50 VST
       Bob's ETH gain = (100 / 400) * 2*0.995 = 0.4975 ETH

     Check Bob' SP deposit has been reduced to 50 VST, and his ETH gain has increased to 1.5 ETH. */
    const alice_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
    const alice_ETHGain_After = (await stabilityPool.getDepositorAssetGain(alice)).toString()

    const alice_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
    const alice_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()

    const totalDeposits = bob_Deposit_Before.add(A_spDeposit)
    const totalDeposits_Asset = bob_Deposit_Before_Asset.add(A_spDeposit)

    assert.isAtMost(th.getDifference(alice_Deposit_After, A_spDeposit.sub(B_debt.mul(A_spDeposit).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(alice_ETHGain_After, th.applyLiquidationFee(B_collateral).mul(A_spDeposit).div(totalDeposits)), 1000000)

    assert.isAtMost(th.getDifference(alice_Deposit_After_Asset, A_spDeposit.sub(B_debt_Asset.mul(A_spDeposit).div(totalDeposits_Asset))), 1000000)
    assert.isAtMost(th.getDifference(alice_ETHGain_After_Asset, th.applyLiquidationFee(B_collateral_Asset).mul(A_spDeposit).div(totalDeposits_Asset).div(toBN(10 ** 10))), 1000000)

    const bob_Deposit_After = await stabilityPool.getCompoundedVSTDeposit(bob)
    const bob_ETHGain_After = await stabilityPool.getDepositorAssetGain(bob)

    const bob_Deposit_After_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)
    const bob_ETHGain_After_Asset = await stabilityPoolERC20.getDepositorAssetGain(bob)

    assert.isAtMost(th.getDifference(bob_Deposit_After, bob_Deposit_Before.sub(B_debt.mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, bob_ETHGain_Before.add(th.applyLiquidationFee(B_collateral).mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(bob_Deposit_After_Asset, bob_Deposit_Before_Asset.sub(B_debt.mul(bob_Deposit_Before_Asset).div(totalDeposits_Asset))), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After_Asset, bob_ETHGain_Before_Asset.add(th.applyLiquidationFee(B_collateral_Asset.div(toBN(10 ** 10))).mul(bob_Deposit_Before_Asset).div(totalDeposits_Asset))), 1000000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const { VSTAmount: A_VSTAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(300, 18)), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(200, 18)), extraParams: { from: bob } })
    const { VSTAmount: C_VSTAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const { VSTAmount: A_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(300, 18)), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(200, 18)), extraParams: { from: bob } })
    const { VSTAmount: C_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })


    await priceFeed.setPrice(dec(100, 18))

    // Check sortedList size
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Liquidate A, B and C
    await activePool.getVSTDebt(ZERO_ADDRESS)
    await defaultPool.getVSTDebt(ZERO_ADDRESS)
    await activePool.getVSTDebt(erc20.address)
    await defaultPool.getVSTDebt(erc20.address)

    await troveManager.liquidate(ZERO_ADDRESS, alice)
    await activePool.getVSTDebt(ZERO_ADDRESS)
    await defaultPool.getVSTDebt(ZERO_ADDRESS)
    await troveManager.liquidate(erc20.address, alice)
    await activePool.getVSTDebt(erc20.address)
    await defaultPool.getVSTDebt(erc20.address)

    await troveManager.liquidate(ZERO_ADDRESS, bob)
    await activePool.getVSTDebt(ZERO_ADDRESS)
    await defaultPool.getVSTDebt(ZERO_ADDRESS)
    await troveManager.liquidate(erc20.address, bob)
    await activePool.getVSTDebt(erc20.address)
    await defaultPool.getVSTDebt(erc20.address)

    await troveManager.liquidate(ZERO_ADDRESS, carol)
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
    assert.equal((await VSTToken.balanceOf(alice)).toString(), A_VSTAmount.add(A_VSTAmount_Asset))
    assert.equal((await VSTToken.balanceOf(bob)).toString(), B_VSTAmount.add(B_VSTAmount_Asset))
    assert.equal((await VSTToken.balanceOf(carol)).toString(), C_VSTAmount.add(C_VSTAmount_Asset))
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(8, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Defaulter opens with 60 VST, 0.6 ETH
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    assert.isTrue(alice_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before_Asset.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    /* Liquidate defaulter. 30 VST and 0.3 ETH is distributed between A, B and C.

    A receives (30 * 2/4) = 15 VST, and (0.3*2/4) = 0.15 ETH
    B receives (30 * 1/4) = 7.5 VST, and (0.3*1/4) = 0.075 ETH
    C receives (30 * 1/4) = 7.5 VST, and (0.3*1/4) = 0.075 ETH
    */
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* After liquidation: 

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

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

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    const bob_rawICR_Asset = bob_Coll_Asset.mul(toBN(dec(100, 18))).div(bob_Debt_Asset)
    assert.isTrue(bob_rawICR.gte(mv._MCR))
    assert.isTrue(bob_rawICR_Asset.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Liquidate Alice, Bob, Carol
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, alice), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, alice), "TroveManager: nothing to liquidate")
    await troveManager.liquidate(ZERO_ADDRESS, bob)
    await troveManager.liquidate(ZERO_ADDRESS, carol)
    await troveManager.liquidate(erc20.address, bob)
    await troveManager.liquidate(erc20.address, carol)

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Check trove statuses - A active (1),  B and C liquidated (3)
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
  })

  it("liquidate(): when SP > 0, triggers VSTA reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves 
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    assert.equal(await stabilityPool.getTotalVSTDeposits(), dec(100, 18))

    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })
    assert.equal(await stabilityPoolERC20.getTotalVSTDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Liquidate trove
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

    await troveManager.liquidate(erc20.address, defaulter_1)
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has increased from the VSTA reward event triggered
    assert.isTrue(G_After.gt(G_Before))
    assert.isTrue(G_After_Asset.gt(G_Before_Asset))
  })

  it("liquidate(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves 
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalVSTDeposits()), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))
    assert.isTrue(G_Before_Asset.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // liquidate trove
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
    assert.isTrue(G_After_Asset.eq(G_Before_Asset))
  })

  // --- liquidateTroves() ---

  it('liquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
    // A, B, C, D, E open troves
    await openTrove({ ICR: toBN(dec(333, 16)), extraParams: { from: D } })
    await openTrove({ ICR: toBN(dec(333, 16)), extraParams: { from: E } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(333, 16)), extraParams: { from: D } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(333, 16)), extraParams: { from: E } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    // Price drops
    await priceFeed.setPrice(dec(175, 18))
    let price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await troveManager.liquidate(ZERO_ADDRESS, A)
    const liqTxA_Asset = await troveManager.liquidate(erc20.address, A)
    assert.isTrue(liqTxA.receipt.status)
    assert.isTrue(liqTxA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, A))

    // A adds 10 VST to the SP, but less than C's debt
    await stabilityPool.provideToSP(dec(10, 18), { from: A })
    await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    price = await priceFeed.getPrice()
    // Confirm system is now in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm C has ICR > TCR
    const TCR = await troveManager.getTCR(ZERO_ADDRESS, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, C, price)
    const TCR_Asset = await troveManager.getTCR(erc20.address, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, C, price)

    assert.isTrue(ICR_C.gt(TCR))
    assert.isTrue(ICR_C_Asset.gt(TCR_Asset))

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    const liqTxBC = await troveManager.liquidateTroves(ZERO_ADDRESS, 2)
    const liqTxBC_Asset = await troveManager.liquidateTroves(erc20.address, 2)
    assert.isTrue(liqTxBC.receipt.status)
    assert.isTrue(liqTxBC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, E))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isTrue(await sortedTroves.contains(erc20.address, C))
    assert.isTrue(await sortedTroves.contains(erc20.address, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, E))

    // // All remaining troves D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedTroves.getSize(ZERO_ADDRESS)).eq(toBN('3')))
    assert.isTrue((await sortedTroves.getSize(erc20.address)).eq(toBN('3')))
    await borrowerOperations.repayVST(ZERO_ADDRESS, dec(1, 18), D, D, { from: D })
    await borrowerOperations.repayVST(ZERO_ADDRESS, dec(1, 18), E, E, { from: E })
    await borrowerOperations.repayVST(erc20.address, dec(1, 18), D, D, { from: D })
    await borrowerOperations.repayVST(erc20.address, dec(1, 18), E, E, { from: E })

    // Check C is the only trove that has pending rewards
    assert.isTrue(await troveManager.hasPendingRewards(ZERO_ADDRESS, C))
    assert.isFalse(await troveManager.hasPendingRewards(ZERO_ADDRESS, D))
    assert.isFalse(await troveManager.hasPendingRewards(ZERO_ADDRESS, E))

    assert.isTrue(await troveManager.hasPendingRewards(erc20.address, C))
    assert.isFalse(await troveManager.hasPendingRewards(erc20.address, D))
    assert.isFalse(await troveManager.hasPendingRewards(erc20.address, E))

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingETH_C = await troveManager.getPendingAssetReward(ZERO_ADDRESS, C)
    const pendingVSTDebt_C = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, C)
    const defaultPoolETH = await defaultPool.getAssetBalance(ZERO_ADDRESS)
    const defaultPoolVSTDebt = await defaultPool.getVSTDebt(ZERO_ADDRESS)

    const pendingETH_C_Asset = await troveManager.getPendingAssetReward(erc20.address, C)
    const pendingVSTDebt_C_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, C)
    const defaultPoolETH_Asset = await defaultPool.getAssetBalance(erc20.address)
    const defaultPoolVSTDebt_Asset = await defaultPool.getVSTDebt(erc20.address)

    assert.isTrue(pendingETH_C.lte(defaultPoolETH))
    assert.isTrue(pendingVSTDebt_C.lte(defaultPoolVSTDebt))

    assert.isTrue(pendingETH_C_Asset.lte(defaultPoolETH_Asset))
    assert.isTrue(pendingVSTDebt_C_Asset.lte(defaultPoolVSTDebt_Asset))
    //Check only difference is dust
    assert.isAtMost(th.getDifference(pendingETH_C, defaultPoolETH), 1000)
    assert.isAtMost(th.getDifference(pendingVSTDebt_C, defaultPoolVSTDebt), 1000)

    assert.isAtMost(th.getDifference(pendingETH_C_Asset, defaultPoolETH_Asset), 1000)
    assert.isAtMost(th.getDifference(pendingVSTDebt_C_Asset, defaultPoolVSTDebt_Asset), 1000)

    // Confirm system is still in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await stabilityPool.provideToSP(dec(50, 18), { from: D })
    await stabilityPool.provideToSP(dec(50, 18), { from: E })
    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: D })
    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: E })

    await priceFeed.setPrice(dec(50, 18))

    // Try to liquidate C again. Check it succeeds and closes C's trove
    const liqTx2 = await troveManager.liquidateTroves(ZERO_ADDRESS, 2)
    const liqTx2_Asset = await troveManager.liquidateTroves(erc20.address, 2)
    assert.isTrue(liqTx2.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, E))
    assert.isTrue((await sortedTroves.getSize(ZERO_ADDRESS)).eq(toBN('1')))

    assert.isTrue(liqTx2_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, C))
    assert.isFalse(await sortedTroves.contains(erc20.address, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, E))
    assert.isTrue((await sortedTroves.getSize(erc20.address)).eq(toBN('1')))
  })

  it('liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // create 5 Troves with varying ICRs
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: flyn } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: flyn } })

    // G,H, I open high-ICR troves
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: graham } })
    await openTrove({ ICR: toBN(dec(90, 18)), extraParams: { from: harriet } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: ida } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: graham } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(90, 18)), extraParams: { from: harriet } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(80, 18)), extraParams: { from: ida } })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, flyn, price)).lte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, flyn, price)).lte(mv._MCR))

    // Confirm troves G, H, I are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, graham, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, harriet, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, ida, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, graham, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, harriet, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, ida, price)).gte(mv._MCR))

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
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, flyn))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, flyn))

    // Check all troves A-E are now closed by liquidation
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(flyn, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(erin, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(flyn, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')

    // Check sorted list has been reduced to length 4 
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')
  })

  it('liquidateTroves(): liquidates  up to the requested number of undercollateralized troves', async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(204, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(204, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    await troveManager.liquidateTroves(ZERO_ADDRESS, 3)
    await troveManager.liquidateTroves(erc20.address, 3)

    const TroveOwnersArrayLength = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const TroveOwnersArrayLength_Asset = await troveManager.getTroveOwnersCount(erc20.address)
    assert.equal(TroveOwnersArrayLength, '3')
    assert.equal(TroveOwnersArrayLength_Asset, '3')

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

  it('liquidateTroves(): does nothing if all troves have ICR > 110%', async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: carol } })

    // Price drops, but all troves remain active at 111% ICR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, whale)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isTrue((await sortedTroves.contains(erc20.address, whale)))
    assert.isTrue((await sortedTroves.contains(erc20.address, alice)))
    assert.isTrue((await sortedTroves.contains(erc20.address, bob)))
    assert.isTrue((await sortedTroves.contains(erc20.address, carol)))

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_Before_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Attempt liqudation sequence
    await assertRevert(troveManager.liquidateTroves(ZERO_ADDRESS, 10), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidateTroves(erc20.address, 10), "TroveManager: nothing to liquidate")

    // Check all troves remain active
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, whale)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isTrue((await sortedTroves.contains(erc20.address, whale)))
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


  it("liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 100) = 200%
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

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    assert.isTrue(alice_ICR_After_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_After_Asset.lte(mv._MCR))
    assert.isTrue(carol_ICR_After_Asset.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const bob_Debt = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const bob_Coll_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const bob_Debt_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    const bob_rawICR_Asset = bob_Coll_Asset.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))
    assert.isTrue(bob_rawICR_Asset.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openTrove({ ICR: toBN(dec(10, 18)), extraVSTAmount: dec(1, 24), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraVSTAmount: dec(1, 24), extraParams: { from: whale } })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    //liquidate A, B, C
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // check trove statuses - A active (1),  B and C closed by liquidation (3)
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
  })

  it("liquidateTroves(): reverts if n = 0", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: carol } })

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

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Liquidation with n = 0
    await assertRevert(troveManager.liquidateTroves(ZERO_ADDRESS, 0), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidateTroves(erc20.address, 0), "TroveManager: nothing to liquidate")

    // Check all troves are still in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
    assert.equal(TCR_Before_Asset, TCR_After_Asset)
  })

  it("liquidateTroves():  liquidates troves with ICR < MCR", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // A, B, C open troves that will remain active when price drops to 100
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: carol } })

    // D, E, F open troves that will fall below MCR when price drops to 100
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    // Check list size is 7
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '7')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '7')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    const flyn_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, flyn, price)

    const alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    const flyn_ICR_Asset = await troveManager.getCurrentICR(erc20.address, flyn, price)

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._MCR))

    assert.isTrue(alice_ICR_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_Asset.gte(mv._MCR))
    assert.isTrue(carol_ICR_Asset.gte(mv._MCR))

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lte(mv._MCR))
    assert.isTrue(erin_ICR.lte(mv._MCR))
    assert.isTrue(flyn_ICR.lte(mv._MCR))

    assert.isTrue(dennis_ICR_Asset.lte(mv._MCR))
    assert.isTrue(erin_ICR_Asset.lte(mv._MCR))
    assert.isTrue(flyn_ICR_Asset.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    //Liquidate sequence
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // check list size reduced to 4
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, flyn))

    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, flyn))
  })

  it("liquidateTroves(): does not affect the liquidated user's token balances", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // D, E, F open troves that will fall below MCR when price drops to 100
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    const D_balanceBefore = await VSTToken.balanceOf(dennis)
    const E_balanceBefore = await VSTToken.balanceOf(erin)
    const F_balanceBefore = await VSTToken.balanceOf(flyn)

    // Check list size is 4
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    //Liquidate sequence
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // check list size reduced to 1
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '1')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '1')

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, flyn))

    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, flyn))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await VSTToken.balanceOf(dennis)).toString(), D_balanceBefore)
    assert.equal((await VSTToken.balanceOf(erin)).toString(), E_balanceBefore)
    assert.equal((await VSTToken.balanceOf(flyn)).toString(), F_balanceBefore)
  })

  it("liquidateTroves(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 VST to SP
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: whale } })

    await stabilityPool.provideToSP(dec(500, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(500, 18), { from: whale })

    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '9')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await th.getTCR(contracts)
    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)

    // Check pool has 500 VST
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), dec(500, 18))
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), dec(500, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Liquidate troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '5')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await th.getTCR(contracts)
    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After.gte(TCR_Before))
    assert.isTrue(TCR_After_Asset.gte(TCR_Before_Asset))
  })

  it("liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    const { collateral: W_coll, totalDebt: W_debt } = await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    const { collateral: A_coll, totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_debt } = await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    const { collateral: d1_coll, totalDebt: d1_debt } = await openTrove({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll, totalDebt: d2_debt } = await openTrove({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll, totalDebt: d3_debt } = await openTrove({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll, totalDebt: d4_debt } = await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    const { collateral: W_coll_Asset, totalDebt: W_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    const { collateral: A_coll_Asset, totalDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    const { collateral: D_coll_Asset, totalDebt: D_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    const { collateral: d1_coll_Asset, totalDebt: d1_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll_Asset, totalDebt: d2_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll_Asset, totalDebt: d3_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll_Asset, totalDebt: d4_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    const totalCollNonDefaulters = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)
    const totalCollDefaulters = d1_coll.add(d2_coll).add(d3_coll).add(d4_coll)
    const totalColl = totalCollNonDefaulters.add(totalCollDefaulters)
    const totalDebt = W_debt.add(A_debt).add(B_debt).add(C_debt).add(D_debt).add(d1_debt).add(d2_debt).add(d3_debt).add(d4_debt)


    const totalCollNonDefaulters_Asset = W_coll_Asset.add(A_coll_Asset).add(B_coll_Asset).add(C_coll_Asset).add(D_coll_Asset)
    const totalCollDefaulters_Asset = d1_coll_Asset.add(d2_coll_Asset).add(d3_coll_Asset).add(d4_coll_Asset)
    const totalColl_Asset = totalCollNonDefaulters_Asset.add(totalCollDefaulters_Asset)
    const totalDebt_Asset = W_debt_Asset.add(A_debt_Asset).add(B_debt_Asset).add(C_debt_Asset).add(D_debt_Asset).add(d1_debt_Asset).add(d2_debt_Asset).add(d3_debt_Asset).add(d4_debt_Asset)

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '9')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '9')

    // Price drops
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const TCR_Before = await th.getTCR(contracts)
    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    assert.isAtMost(th.getDifference(TCR_Before, totalColl.mul(price).div(totalDebt)), 1000)
    assert.isAtMost(th.getDifference(TCR_Before_Asset, totalColl_Asset.mul(price).div(totalDebt)), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), '0')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Liquidate
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '5')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '5')

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await th.getTCR(contracts)
    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2050+50+50+50+50+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, totalCollNonDefaulters.add(th.applyLiquidationFee(totalCollDefaulters)).mul(price).div(totalDebt)), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))))

    assert.isAtMost(th.getDifference(TCR_After_Asset, totalCollNonDefaulters_Asset.add(th.applyLiquidationFee(totalCollDefaulters_Asset)).mul(price).div(totalDebt_Asset)), 1000)
    assert.isTrue(TCR_Before_Asset.gte(TCR_After_Asset))
    assert.isTrue(TCR_After_Asset.gte(TCR_Before_Asset.mul(toBN(995)).div(toBN(1000))))
  })

  it("liquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 VST to the SP
    const whaleDeposit = toBN(dec(40000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: whaleDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: whaleDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(whaleDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(whaleDeposit, { from: whale })

    const A_deposit = toBN(dec(10000, 18))
    const B_deposit = toBN(dec(30000, 18))
    const { collateral: A_coll, totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: A_deposit, extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: B_deposit, extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: A_deposit, extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: B_deposit, extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    const liquidatedColl = A_coll.add(B_coll).add(C_coll)
    const liquidatedDebt = A_debt.add(B_debt).add(C_debt)

    const liquidatedColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)
    const liquidatedDebt_Asset = A_debt_Asset.add(B_debt_Asset).add(C_debt_Asset)

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(A_deposit, { from: alice })
    await stabilityPool.provideToSP(B_deposit, { from: bob })

    await stabilityPoolERC20.provideToSP(A_deposit, { from: alice })
    await stabilityPoolERC20.provideToSP(B_deposit, { from: bob })

    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Check 800 VST in Pool
    const totalDeposits = whaleDeposit.add(A_deposit).add(B_deposit)
    const totalDeposits_Asset = whaleDeposit.add(A_deposit).add(B_deposit)
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), totalDeposits)
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), totalDeposits)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

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
    Alice: 100 VST
    Bob:   300 VST
    Carol: 0 VST

    Total VST in Pool: 800 VST

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 150 + 350 + 150 = 650 VST
    Total liquidated ETH = 1.1 + 3.1 + 1.1 = 5.3 ETH

    whale VST loss: 650 * (400/800) = 325 VST
    alice VST loss:  650 *(100/800) = 81.25 VST
    bob VST loss: 650 * (300/800) = 243.75 VST

    whale remaining deposit: (400 - 325) = 75 VST
    alice remaining deposit: (100 - 81.25) = 18.75 VST
    bob remaining deposit: (300 - 243.75) = 56.25 VST

    whale eth gain: 5*0.995 * (400/800) = 2.4875 eth
    alice eth gain: 5*0.995 *(100/800) = 0.621875 eth
    bob eth gain: 5*0.995 * (300/800) = 1.865625 eth

    Total remaining deposits: 150 VST
    Total ETH gain: 4.975 ETH */

    // Check remaining VST Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = await stabilityPool.getCompoundedVSTDeposit(whale)
    const alice_Deposit_After = await stabilityPool.getCompoundedVSTDeposit(alice)
    const bob_Deposit_After = await stabilityPool.getCompoundedVSTDeposit(bob)

    const whale_ETHGain = await stabilityPool.getDepositorAssetGain(whale)
    const alice_ETHGain = await stabilityPool.getDepositorAssetGain(alice)
    const bob_ETHGain = await stabilityPool.getDepositorAssetGain(bob)


    const whale_Deposit_After_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(whale)
    const alice_Deposit_After_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
    const bob_Deposit_After_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)

    const whale_ETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(whale)
    const alice_ETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(alice)
    const bob_ETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(bob)

    assert.isAtMost(th.getDifference(whale_Deposit_After, whaleDeposit.sub(liquidatedDebt.mul(whaleDeposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, A_deposit.sub(liquidatedDebt.mul(A_deposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, B_deposit.sub(liquidatedDebt.mul(B_deposit).div(totalDeposits))), 100000)

    assert.isAtMost(th.getDifference(whale_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(whaleDeposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(alice_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(A_deposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(bob_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(B_deposit).div(totalDeposits)), 100000)

    assert.isAtMost(th.getDifference(whale_Deposit_After_Asset, whaleDeposit.sub(liquidatedDebt_Asset.mul(whaleDeposit).div(totalDeposits_Asset))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After_Asset, A_deposit.sub(liquidatedDebt_Asset.mul(A_deposit).div(totalDeposits_Asset))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After_Asset, B_deposit.sub(liquidatedDebt_Asset.mul(B_deposit).div(totalDeposits_Asset))), 100000)

    assert.isAtMost(th.getDifference(whale_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset).mul(whaleDeposit).div(totalDeposits_Asset).div(toBN(10 ** 10))), 100000)
    assert.isAtMost(th.getDifference(alice_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset).mul(A_deposit).div(totalDeposits_Asset).div(toBN(10 ** 10))), 100000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset).mul(B_deposit).div(totalDeposits_Asset).div(toBN(10 ** 10))), 100000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_VSTinSP = (await stabilityPool.getTotalVSTDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getAssetBalance()).toString()

    const total_VSTinSP_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    const total_ETHinSP_Asset = (await stabilityPoolERC20.getAssetBalance()).toString()

    assert.isAtMost(th.getDifference(total_VSTinSP, totalDeposits.sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, th.applyLiquidationFee(liquidatedColl)), 1000)
    assert.isAtMost(th.getDifference(total_VSTinSP_Asset, totalDeposits_Asset.sub(liquidatedDebt_Asset)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP_Asset, th.applyLiquidationFee(liquidatedColl_Asset)), 1000)
  })

  it("liquidateTroves(): when SP > 0, triggers VSTA reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    assert.equal(await stabilityPool.getTotalVSTDeposits(), dec(100, 18))

    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })
    assert.equal(await stabilityPoolERC20.getTotalVSTDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Liquidate troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 2)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

    await troveManager.liquidateTroves(erc20.address, 2)
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has increased from the VSTA reward event triggered
    assert.isTrue(G_After.gt(G_Before))
    assert.isTrue(G_After_Asset.gt(G_Before_Asset))
  })

  it("liquidateTroves(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalVSTDeposits()), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)
    assert.isTrue(G_Before_Asset.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // liquidate troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 2)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

    await troveManager.liquidateTroves(erc20.address, 2)
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
    assert.isTrue(G_After_Asset.eq(G_Before_Asset))
  })


  // --- batchLiquidateTroves() ---

  it('batchLiquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
    // A, B, C, D, E open troves 
    await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(364, 16)), extraParams: { from: D } })
    await openTrove({ ICR: toBN(dec(364, 16)), extraParams: { from: E } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraParams: { from: C } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(364, 16)), extraParams: { from: D } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(364, 16)), extraParams: { from: E } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: B } })

    // Price drops
    await priceFeed.setPrice(dec(175, 18))
    let price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await troveManager.liquidate(ZERO_ADDRESS, A)
    const liqTxA_Asset = await troveManager.liquidate(erc20.address, A)
    assert.isTrue(liqTxA.receipt.status)
    assert.isTrue(liqTxA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, A))

    // A adds 10 VST to the SP, but less than C's debt
    await stabilityPool.provideToSP(dec(10, 18), { from: A })
    await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    price = await priceFeed.getPrice()
    // Confirm system is now in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm C has ICR > TCR
    const TCR = await troveManager.getTCR(ZERO_ADDRESS, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, C, price)

    const TCR_Asset = await troveManager.getTCR(erc20.address, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, C, price)

    assert.isTrue(ICR_C.gt(TCR))
    assert.isTrue(ICR_C_Asset.gt(TCR_Asset))

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    const liqTxBC = await troveManager.liquidateTroves(ZERO_ADDRESS, 2)
    const liqTxBC_Asset = await troveManager.liquidateTroves(erc20.address, 2)
    assert.isTrue(liqTxBC.receipt.status)
    assert.isTrue(liqTxBC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, E))

    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isTrue(await sortedTroves.contains(erc20.address, C))
    assert.isTrue(await sortedTroves.contains(erc20.address, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, E))

    // // All remaining troves D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedTroves.getSize(ZERO_ADDRESS)).eq(toBN('3')))
    await borrowerOperations.repayVST(ZERO_ADDRESS, dec(1, 18), D, D, { from: D })
    await borrowerOperations.repayVST(ZERO_ADDRESS, dec(1, 18), E, E, { from: E })

    assert.isTrue((await sortedTroves.getSize(erc20.address)).eq(toBN('3')))
    await borrowerOperations.repayVST(erc20.address, dec(1, 18), D, D, { from: D })
    await borrowerOperations.repayVST(erc20.address, dec(1, 18), E, E, { from: E })

    // Check C is the only trove that has pending rewards
    assert.isTrue(await troveManager.hasPendingRewards(ZERO_ADDRESS, C))
    assert.isFalse(await troveManager.hasPendingRewards(ZERO_ADDRESS, D))
    assert.isFalse(await troveManager.hasPendingRewards(ZERO_ADDRESS, E))

    assert.isTrue(await troveManager.hasPendingRewards(erc20.address, C))
    assert.isFalse(await troveManager.hasPendingRewards(erc20.address, D))
    assert.isFalse(await troveManager.hasPendingRewards(erc20.address, E))

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingETH_C = await troveManager.getPendingAssetReward(ZERO_ADDRESS, C)
    const pendingVSTDebt_C = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, C)
    const defaultPoolETH = await defaultPool.getAssetBalance(ZERO_ADDRESS)
    const defaultPoolVSTDebt = await defaultPool.getVSTDebt(ZERO_ADDRESS)

    const pendingETH_C_Asset = await troveManager.getPendingAssetReward(erc20.address, C)
    const pendingVSTDebt_C_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, C)
    const defaultPoolETH_Asset = await defaultPool.getAssetBalance(erc20.address)
    const defaultPoolVSTDebt_Asset = await defaultPool.getVSTDebt(erc20.address)

    assert.isTrue(pendingETH_C.lte(defaultPoolETH))
    assert.isTrue(pendingVSTDebt_C.lte(defaultPoolVSTDebt))

    assert.isTrue(pendingETH_C_Asset.lte(defaultPoolETH_Asset))
    assert.isTrue(pendingVSTDebt_C_Asset.lte(defaultPoolVSTDebt_Asset))
    //Check only difference is dust
    assert.isAtMost(th.getDifference(pendingETH_C, defaultPoolETH), 1000)
    assert.isAtMost(th.getDifference(pendingVSTDebt_C, defaultPoolVSTDebt), 1000)

    assert.isAtMost(th.getDifference(pendingETH_C_Asset, defaultPoolETH_Asset), 1000)
    assert.isAtMost(th.getDifference(pendingVSTDebt_C_Asset, defaultPoolVSTDebt_Asset), 1000)

    // Confirm system is still in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await stabilityPool.provideToSP(dec(50, 18), { from: D })
    await stabilityPool.provideToSP(dec(50, 18), { from: E })

    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: D })
    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: E })

    await priceFeed.setPrice(dec(50, 18))

    // Try to liquidate C again. Check it succeeds and closes C's trove
    const liqTx2 = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [C, D])
    const liqTx2_Asset = await troveManager.batchLiquidateTroves(erc20.address, [C, D])
    assert.isTrue(liqTx2.receipt.status)
    assert.isTrue(liqTx2_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, E))
    assert.isTrue((await sortedTroves.getSize(ZERO_ADDRESS)).eq(toBN('1')))

    assert.isFalse(await sortedTroves.contains(erc20.address, C))
    assert.isFalse(await sortedTroves.contains(erc20.address, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, E))
    assert.isTrue((await sortedTroves.getSize(erc20.address)).eq(toBN('1')))
  })

  it('batchLiquidateTroves(): closes every trove with ICR < MCR in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '6')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lt(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
    await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Check all troves A-C are now closed by liquidation
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '3')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '3')
  })

  it('batchLiquidateTroves(): does not liquidate troves that are not in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: toBN(dec(500, 18)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '6')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).lt(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, dennis, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).lt(mv._MCR))

    liquidationArray = [alice, bob]  // C-E not included
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
    await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')

    // Confirm troves C-E remain in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))

    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))

    // Check all troves C-E are still active
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')

    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(erin, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')
  })

  it('batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '6')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lt(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR >= 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
    await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);

    // Confirm troves D-E and whale remain in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check all troves D-E and whale remain active
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(erin, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '3')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '3')
  })

  it('batchLiquidateTroves(): reverts if array is empty', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '6')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    liquidationArray = []
    try {
      const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "TroveManager: Calldata address array must not be empty")
    }
    try {
      const tx = await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "TroveManager: Calldata address array must not be empty")
    }
  })

  it("batchLiquidateTroves(): skips if trove is non-existent", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    const { totalDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 0) // check trove non-existent
    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 0) // check trove non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '5')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lt(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
    await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '3')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '3')

    // Confirm trove C non-existent
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '0')

    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '0')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))
    th.assertIsApproximatelyEqual((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit.sub(A_debt_Asset).sub(B_debt_Asset))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));
  })

  it("batchLiquidateTroves(): skips if a trove has been closed", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })

    const { totalDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: bob } })

    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '6')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: whale })

    // Whale transfers to Carol so she can close her trove
    await VSTToken.transfer(carol, dec(200, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Carol liquidated, and her trove is closed
    const txCarolClose = await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: carol })
    const txCarolClose_Asset = await borrowerOperations.closeTrove(erc20.address, { from: carol })
    assert.isTrue(txCarolClose.receipt.status)
    assert.isTrue(txCarolClose_Asset.receipt.status)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 2)  // check trove closed
    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lt(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, liquidationArray);
    await troveManager.batchLiquidateTroves(erc20.address, liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')

    // Trove C still closed by user
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '2')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '3')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '3')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))
    th.assertIsApproximatelyEqual((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address));
  })

  it("batchLiquidateTroves: when SP > 0, triggers VSTA reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(167, 16)), extraParams: { from: C } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })
    assert.equal(await stabilityPool.getTotalVSTDeposits(), dec(100, 18))
    assert.equal(await stabilityPoolERC20.getTotalVSTDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Liquidate troves
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

    await troveManager.batchLiquidateTroves(erc20.address, [defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has increased from the VSTA reward event triggered
    assert.isTrue(G_After.gt(G_Before))
    assert.isTrue(G_After_Asset.gt(G_Before_Asset))
  })

  it("batchLiquidateTroves(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(167, 16)), extraParams: { from: C } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
    await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalVSTDeposits()), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    const G_Before_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))
    assert.isTrue(G_Before_Asset.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100VST, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // liquidate troves
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

    await troveManager.batchLiquidateTroves(erc20.address, [defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)
    const G_After_Asset = await stabilityPoolERC20.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
    assert.isTrue(G_After_Asset.eq(G_Before_Asset))
  })

  // --- redemptions ---


  it('getRedemptionHints(): gets the address of the first Trove and the final ICR of the last Trove involved in a redemption', async () => {
    // --- SETUP ---
    const partialRedemptionAmount = toBN(dec(100, 18))
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: partialRedemptionAmount, extraParams: { from: alice } })
    const { netDebt: B_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset }
      = await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: partialRedemptionAmount, extraParams: { from: alice } })

    const { netDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    const { netDebt: C_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: carol } })

    // Dennis' Trove should be untouched by redemption, because its ICR will be < 110% after the price drop
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraParams: { from: dennis } })

    // Drop the price
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // --- TEST ---
    const redemptionAmount = C_debt.add(B_debt).add(partialRedemptionAmount)
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const redemptionAmount_Asset = C_debt_Asset.add(B_debt_Asset).add(partialRedemptionAmount)

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount_Asset, price, 0)


    assert.equal(firstRedemptionHint, carol)
    assert.equal(firstRedemptionHint_Asset, carol)
    const expectedICR = A_coll.mul(price).sub(partialRedemptionAmount.mul(mv._1e18BN)).div(A_totalDebt.sub(partialRedemptionAmount))
    const expectedICR_Asset = A_coll_Asset.mul(price).sub(partialRedemptionAmount.mul(mv._1e18BN)).div(A_totalDebt_Asset.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(partialRedemptionHintNICR, expectedICR)
    th.assertIsApproximatelyEqual(partialRedemptionHintNICR_Asset, expectedICR_Asset)
  });

  it('getRedemptionHints(): returns 0 as partialRedemptionHintNICR when reaching _maxIterations', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(310, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraParams: { from: dennis } })

    const price = await priceFeed.getPrice();

    // --- TEST ---

    // Get hints for a redemption of 170 + 30 + some extra VST. At least 3 iterations are needed
    // for total redemption of the given amount.
    const {
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, '210' + _18_zeros, price, 2) // limit _maxIterations to 2

    const {
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, '210' + _18_zeros, price, 2)

    assert.equal(partialRedemptionHintNICR, '0')
    assert.equal(partialRedemptionHintNICR_Asset, '0')
  });

  it('redeemCollateral(): cancels the provided VST with debt from Troves with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })
    const partialRedemptionAmount = toBN(2)

    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    const redemptionAmount_Asset = C_netDebt_Asset.add(B_netDebt_Asset).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(dennis))

    const dennis_VSTBalance_Before = await VSTToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 VST
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount, price, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 20 VST
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove_After = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove_After = await troveManager.Troves(carol, ZERO_ADDRESS)

    const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_After_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_After_Asset = await troveManager.Troves(carol, erc20.address)

    const alice_debt_After = alice_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After = bob_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After = carol_Trove_After[th.TROVE_DEBT_INDEX].toString()

    const alice_debt_After_Asset = alice_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After_Asset = bob_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After_Asset = carol_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()

    /* check that Dennis' redeemed 20 VST has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) VST debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(alice_debt_After_Asset, A_totalDebt_Asset.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')
    assert.equal(bob_debt_After_Asset, '0')
    assert.equal(carol_debt_After_Asset, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_After_Asset = toBN(await erc20.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    const receivedETH_Asset = dennis_ETHBalance_After_Asset.sub(dennis_ETHBalance_Before_Asset)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedTotalETHDrawn_Asset = redemptionAmount_Asset.div(toBN(200))
    const expectedReceivedETH = expectedTotalETHDrawn.sub(toBN(ETHFee))
    const expectedReceivedETH_Asset = expectedTotalETHDrawn_Asset.sub(toBN(ETHFee_Asset))

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)
    th.assertIsApproximatelyEqual(expectedReceivedETH_Asset.div(toBN(10 ** 10)), receivedETH_Asset)

    const dennis_VSTBalance_After = (await VSTToken.balanceOf(dennis)).toString()
    assert.equal(dennis_VSTBalance_After, dennis_VSTBalance_Before.sub(redemptionAmount).sub(redemptionAmount_Asset))
  })

  it('redeemCollateral(): with invalid first hint, zero address', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    const redemptionAmount_Asset = C_netDebt_Asset.add(B_netDebt_Asset).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(dennis))

    const dennis_VSTBalance_Before = await VSTToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 VST
    const {
      1: partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const {
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount, price, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 20 VST
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      ZERO_ADDRESS, // invalid first hint
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )


    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      ZERO_ADDRESS, // invalid first hint
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove_After = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove_After = await troveManager.Troves(carol, ZERO_ADDRESS)

    const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_After_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_After_Asset = await troveManager.Troves(carol, erc20.address)

    const alice_debt_After = alice_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After = bob_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After = carol_Trove_After[th.TROVE_DEBT_INDEX].toString()

    const alice_debt_After_Asset = alice_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After_Asset = bob_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After_Asset = carol_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()

    /* check that Dennis' redeemed 20 VST has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) VST debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(alice_debt_After_Asset, A_totalDebt_Asset.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')
    assert.equal(bob_debt_After_Asset, '0')
    assert.equal(carol_debt_After_Asset, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const dennis_ETHBalance_After_Asset = toBN(await erc20.balanceOf(dennis))
    const receivedETH_Asset = dennis_ETHBalance_After_Asset.sub(dennis_ETHBalance_Before_Asset)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn.sub(toBN(ETHFee))

    const expectedTotalETHDrawn_Asset = redemptionAmount_Asset.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedReceivedETH_Asset = expectedTotalETHDrawn_Asset.sub(toBN(ETHFee_Asset))

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)
    th.assertIsApproximatelyEqual(expectedReceivedETH_Asset.div(toBN(10 ** 10)), receivedETH_Asset)

    const dennis_VSTBalance_After = (await VSTToken.balanceOf(dennis)).toString()
    assert.equal(dennis_VSTBalance_After, dennis_VSTBalance_Before.sub(redemptionAmount).sub(redemptionAmount_Asset))
  })

  it('redeemCollateral(): with invalid first hint, non-existent trove', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    const redemptionAmount_Asset = C_netDebt_Asset.add(B_netDebt_Asset).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(dennis))

    const dennis_VSTBalance_Before = await VSTToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 VST
    const {
      1: partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const {
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount_Asset, price, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 20 VST
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      erin, // invalid first hint, it doesn’t have a trove
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      erin, // invalid first hint, it doesn’t have a trove
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove_After = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove_After = await troveManager.Troves(carol, ZERO_ADDRESS)

    const alice_debt_After = alice_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After = bob_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After = carol_Trove_After[th.TROVE_DEBT_INDEX].toString()

    const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_After_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_After_Asset = await troveManager.Troves(carol, erc20.address)

    const alice_debt_After_Asset = alice_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After_Asset = bob_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After_Asset = carol_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()

    /* check that Dennis' redeemed 20 VST has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) VST debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(alice_debt_After_Asset, A_totalDebt_Asset.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')
    assert.equal(bob_debt_After_Asset, '0')
    assert.equal(carol_debt_After_Asset, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_After_Asset = toBN(await erc20.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    const receivedETH_Asset = dennis_ETHBalance_After_Asset.sub(dennis_ETHBalance_Before_Asset)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedTotalETHDrawn_Asset = redemptionAmount_Asset.div(toBN(200))

    const expectedReceivedETH = expectedTotalETHDrawn.sub(toBN(ETHFee))
    const expectedReceivedETH_Asset = expectedTotalETHDrawn_Asset.sub(toBN(ETHFee_Asset))

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)
    th.assertIsApproximatelyEqual(expectedReceivedETH_Asset.div(toBN(10 ** 10)), receivedETH_Asset)

    const dennis_VSTBalance_After = (await VSTToken.balanceOf(dennis)).toString()
    assert.equal(dennis_VSTBalance_After, dennis_VSTBalance_Before.sub(redemptionAmount).sub(redemptionAmount_Asset))
  })

  it('redeemCollateral(): with invalid first hint, trove below MCR', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    const redemptionAmount_Asset = C_netDebt_Asset.add(B_netDebt_Asset).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(dennis))

    const dennis_VSTBalance_Before = await VSTToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // Increase price to start Erin, and decrease it again so its ICR is under MCR
    await priceFeed.setPrice(price.mul(toBN(2)))
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: erin } })
    await priceFeed.setPrice(price)



    // --- TEST ---

    // Find hints for redeeming 20 VST
    const {
      1: partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const {
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount_Asset, price, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 20 VST
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      erin, // invalid trove, below MCR
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      erin, // invalid trove, below MCR
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove_After = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove_After = await troveManager.Troves(carol, ZERO_ADDRESS)

    const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_After_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_After_Asset = await troveManager.Troves(carol, erc20.address)

    const alice_debt_After = alice_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After = bob_Trove_After[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After = carol_Trove_After[th.TROVE_DEBT_INDEX].toString()

    const alice_debt_After_Asset = alice_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_debt_After_Asset = bob_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()
    const carol_debt_After_Asset = carol_Trove_After_Asset[th.TROVE_DEBT_INDEX].toString()

    /* check that Dennis' redeemed 20 VST has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) VST debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(alice_debt_After_Asset, A_totalDebt_Asset.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    assert.equal(bob_debt_After_Asset, '0')
    assert.equal(carol_debt_After_Asset, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_After_Asset = toBN(await erc20.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    const receivedETH_Asset = dennis_ETHBalance_After_Asset.sub(dennis_ETHBalance_Before_Asset)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedTotalETHDrawn_Asset = redemptionAmount_Asset.div(toBN(200)) // convert redemptionAmount VST to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn.sub(toBN(ETHFee))
    const expectedReceivedETH_Asset = expectedTotalETHDrawn_Asset.sub(toBN(ETHFee_Asset))

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)
    th.assertIsApproximatelyEqual(expectedReceivedETH_Asset.div(toBN(10 ** 10)), receivedETH_Asset)

    const dennis_VSTBalance_After = (await VSTToken.balanceOf(dennis)).toString()
    assert.equal(dennis_VSTBalance_After, dennis_VSTBalance_Before.sub(redemptionAmount).sub(redemptionAmount_Asset))
  })

  it('redeemCollateral(): ends the redemption sequence when the token redemption request has been filled', async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open troves
    const { netDebt: A_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })

    const { netDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })

    const redemptionAmount = A_debt.add(B_debt).add(C_debt)
    const redemptionAmount_Asset = A_debt_Asset.add(B_debt_Asset).add(C_debt_Asset)

    const { totalDebt: D_totalDebt, collateral: D_coll } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt, collateral: E_coll } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: erin } })

    const { totalDebt: D_totalDebt_Asset, collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset, collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: erin } })

    // --- TEST --- 

    // open trove from redeemer.  Redeemer has highest ICR (100ETH, 100 VST), 20000%
    const { VSTAmount: F_VSTAmount } = await openTrove({ ICR: toBN(dec(200, 18)), extraVSTAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })
    const { VSTAmount: F_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 18)), extraVSTAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Flyn redeems collateral
    await troveManager.redeemCollateral(ZERO_ADDRESS, redemptionAmount, alice, alice, alice, 0, 0, th._100pct, { from: flyn })
    await troveManager.redeemCollateral(erc20.address, redemptionAmount_Asset, alice, alice, alice, 0, 0, th._100pct, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 VST
    const flynBalance = await VSTToken.balanceOf(flyn)
    th.assertIsApproximatelyEqual(flynBalance, F_VSTAmount.add(F_VSTAmount_Asset).sub(redemptionAmount).sub(redemptionAmount_Asset))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, alice)
    const bob_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, bob)
    const carol_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, carol)

    const alice_Debt_Asset = await troveManager.getTroveDebt(erc20.address, alice)
    const bob_Debt_Asset = await troveManager.getTroveDebt(erc20.address, bob)
    const carol_Debt_Asset = await troveManager.getTroveDebt(erc20.address, carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0)

    assert.equal(alice_Debt_Asset, 0)
    assert.equal(bob_Debt_Asset, 0)
    assert.equal(carol_Debt_Asset, 0)

    // check Alice, Bob and Carol troves are closed by redemption
    const alice_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, alice)
    const bob_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, bob)
    const carol_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, carol)

    const alice_Status_Asset = await troveManager.getTroveStatus(erc20.address, alice)
    const bob_Status_Asset = await troveManager.getTroveStatus(erc20.address, bob)
    const carol_Status_Asset = await troveManager.getTroveStatus(erc20.address, carol)

    assert.equal(alice_Status, 4)
    assert.equal(bob_Status, 4)
    assert.equal(carol_Status, 4)

    assert.equal(alice_Status_Asset, 4)
    assert.equal(bob_Status_Asset, 4)
    assert.equal(carol_Status_Asset, 4)

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    const dennis_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, dennis)
    const erin_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, erin)

    const dennis_Debt_Asset = await troveManager.getTroveDebt(erc20.address, dennis)
    const erin_Debt_Asset = await troveManager.getTroveDebt(erc20.address, erin)

    th.assertIsApproximatelyEqual(dennis_Debt, D_totalDebt)
    th.assertIsApproximatelyEqual(erin_Debt, E_totalDebt)

    th.assertIsApproximatelyEqual(dennis_Debt_Asset, D_totalDebt_Asset)
    th.assertIsApproximatelyEqual(erin_Debt_Asset, E_totalDebt_Asset)

    const dennis_Coll = await troveManager.getTroveColl(ZERO_ADDRESS, dennis)
    const erin_Coll = await troveManager.getTroveColl(ZERO_ADDRESS, erin)

    const dennis_Coll_Asset = await troveManager.getTroveColl(erc20.address, dennis)
    const erin_Coll_Asset = await troveManager.getTroveColl(erc20.address, erin)

    assert.equal(dennis_Coll.toString(), D_coll.toString())
    assert.equal(erin_Coll.toString(), E_coll.toString())

    assert.equal(dennis_Coll_Asset.toString(), D_coll_Asset.toString())
    assert.equal(erin_Coll_Asset.toString(), E_coll_Asset.toString())
  })

  it('redeemCollateral(): ends the redemption sequence when max iterations have been reached', async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol open troves with equal collateral ratio
    const { netDebt: A_debt } = await openTrove({ ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt } = await openTrove({ ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })

    const { netDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: alice } })
    const { netDebt: B_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: bob } })
    const { netDebt: C_debt_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(286, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })

    const redemptionAmount = A_debt.add(B_debt)
    const attemptedRedemptionAmount = redemptionAmount.add(C_debt)

    const redemptionAmount_Asset = A_debt_Asset.add(B_debt_Asset)
    const attemptedRedemptionAmount_Asset = redemptionAmount_Asset.add(C_debt_Asset)

    // --- TEST --- 

    // open trove from redeemer.  Redeemer has highest ICR (100ETH, 100 VST), 20000%
    const { VSTAmount: F_VSTAmount } = await openTrove({ ICR: toBN(dec(200, 18)), extraVSTAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })
    const { VSTAmount: F_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 18)), extraVSTAmount: redemptionAmount.mul(toBN(2)), extraParams: { from: flyn } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Flyn redeems collateral with only two iterations
    await troveManager.redeemCollateral(ZERO_ADDRESS, attemptedRedemptionAmount, alice, alice, alice, 0, 2, th._100pct, { from: flyn })
    await troveManager.redeemCollateral(erc20.address, attemptedRedemptionAmount_Asset, alice, alice, alice, 0, 2, th._100pct, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-40) = 60 VST
    const flynBalance = (await VSTToken.balanceOf(flyn)).toString()
    th.assertIsApproximatelyEqual(flynBalance, F_VSTAmount.add(F_VSTAmount_Asset).sub(redemptionAmount).sub(redemptionAmount_Asset))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, alice)
    const bob_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, bob)
    const carol_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, carol)

    const alice_Debt_Asset = await troveManager.getTroveDebt(erc20.address, alice)
    const bob_Debt_Asset = await troveManager.getTroveDebt(erc20.address, bob)
    const carol_Debt_Asset = await troveManager.getTroveDebt(erc20.address, carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(alice_Debt_Asset, 0)
    assert.equal(bob_Debt_Asset, 0)
    th.assertIsApproximatelyEqual(carol_Debt, C_totalDebt)
    th.assertIsApproximatelyEqual(carol_Debt_Asset, C_totalDebt_Asset)

    // check Alice and Bob troves are closed, but Carol is not
    const alice_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, alice)
    const bob_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, bob)
    const carol_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, carol)

    const alice_Status_Asset = await troveManager.getTroveStatus(erc20.address, alice)
    const bob_Status_Asset = await troveManager.getTroveStatus(erc20.address, bob)
    const carol_Status_Asset = await troveManager.getTroveStatus(erc20.address, carol)

    assert.equal(alice_Status, 4)
    assert.equal(bob_Status, 4)
    assert.equal(carol_Status, 1)

    assert.equal(alice_Status_Asset, 4)
    assert.equal(bob_Status_Asset, 4)
    assert.equal(carol_Status_Asset, 1)
  })

  it("redeemCollateral(): performs partial redemption if resultant debt is > minimum net debt", async () => {
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), A, A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(20000, 18), ZERO_ADDRESS), B, B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(30000, 18), ZERO_ADDRESS), C, C, { from: C, value: dec(1000, 'ether') })

    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), erc20.address), A, A, { from: A })
    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(20000, 18), erc20.address), B, B, { from: B })
    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(30000, 18), erc20.address), C, C, { from: C })

    // A and C send all their tokens to B
    await VSTToken.transfer(B, await VSTToken.balanceOf(A), { from: A })
    await VSTToken.transfer(B, await VSTToken.balanceOf(C), { from: C })

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // VST redemption is 55000 US
    const VSTRedemption = dec(55000, 18)
    await th.redeemCollateralAndGetTxObject(B, contracts, VSTRedemption, ZERO_ADDRESS)
    await th.redeemCollateralAndGetTxObject(B, contracts, VSTRedemption, erc20.address)

    // Check B, C closed and A remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    assert.isTrue(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    // A's remaining debt = 29800 + 19800 + 9800 + 200 - 55000 = 4600
    const A_debt = await troveManager.getTroveDebt(ZERO_ADDRESS, A)
    const A_debt_Asset = await troveManager.getTroveDebt(erc20.address, A)
    await th.assertIsApproximatelyEqual(A_debt, dec(4600, 18), 1000)
    await th.assertIsApproximatelyEqual(A_debt_Asset, dec(4600, 18), 1000)
  })

  it("redeemCollateral(): doesn't perform partial redemption if resultant debt would be < minimum net debt", async () => {
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(6000, 18), ZERO_ADDRESS), A, A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(20000, 18), ZERO_ADDRESS), B, B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(30000, 18), ZERO_ADDRESS), C, C, { from: C, value: dec(1000, 'ether') })

    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(6000, 18), erc20.address), A, A, { from: A })
    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(20000, 18), erc20.address), B, B, { from: B })
    await borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(30000, 18), erc20.address), C, C, { from: C })

    // A and C send all their tokens to B
    await VSTToken.transfer(B, await VSTToken.balanceOf(A), { from: A })
    await VSTToken.transfer(B, await VSTToken.balanceOf(C), { from: C })

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // VST redemption is 55000 VST
    const VSTRedemption = dec(55000, 18)
    await th.redeemCollateralAndGetTxObject(B, contracts, VSTRedemption, ZERO_ADDRESS)
    await th.redeemCollateralAndGetTxObject(B, contracts, VSTRedemption, erc20.address)

    // Check B, C closed and A remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    assert.isTrue(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    // A's remaining debt would be 29950 + 19950 + 5950 + 50 - 55000 = 900.
    // Since this is below the min net debt of 100, A should be skipped and untouched by the redemption
    const A_debt = await troveManager.getTroveDebt(ZERO_ADDRESS, A)
    const A_debt_Asset = await troveManager.getTroveDebt(erc20.address, A)
    await th.assertIsApproximatelyEqual(A_debt, dec(6000, 18))
    await th.assertIsApproximatelyEqual(A_debt_Asset, dec(6000, 18))
  })

  it('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(363, 16)), extraVSTAmount: dec(5, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(344, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(333, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(363, 16)), extraVSTAmount: dec(5, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(344, 16)), extraVSTAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(333, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: carol } })

    const partialRedemptionAmount = toBN(2)
    const fullfilledRedemptionAmount = C_netDebt.add(B_netDebt)
    const fullfilledRedemptionAmount_Asset = C_netDebt_Asset.add(B_netDebt_Asset)
    const redemptionAmount = fullfilledRedemptionAmount.add(partialRedemptionAmount)
    const redemptionAmount_Asset = fullfilledRedemptionAmount_Asset.add(partialRedemptionAmount)

    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(dennis))

    const dennis_VSTBalance_Before = await VSTToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, redemptionAmount, price, 0)

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, redemptionAmount_Asset, price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      dennis,
      dennis
    )

    const frontRunRedepmtion = toBN(dec(1, 18))
    // Oops, another transaction gets in the way
    {
      const {
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, dec(1, 18), price, 0)


      const {
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, dec(1, 18), price, 0)

      const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
        partialRedemptionHintNICR,
        dennis,
        dennis
      )

      const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
        partialRedemptionHintNICR_Asset,
        dennis,
        dennis
      )

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      // Alice redeems 1 VST from Carol's Trove
      await troveManager.redeemCollateral(ZERO_ADDRESS,
        frontRunRedepmtion,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: alice }
      )

      await troveManager.redeemCollateral(erc20.address,
        frontRunRedepmtion,
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_Asset,
        lowerPartialRedemptionHint_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 VST
    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    // Since Alice already redeemed 1 VST from Carol's Trove, Dennis was  able to redeem:
    //  - 9 VST from Carol's
    //  - 8 VST from Bob's
    // for a total of 17 VST.

    // Dennis calculated his hint for redeeming 2 VST from Alice's Trove, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 VST to fully complete his redemption of 20 VST.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const dennis_ETHBalance_After_Asset = toBN(await erc20.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    const receivedETH_Asset = dennis_ETHBalance_After_Asset.sub(dennis_ETHBalance_Before_Asset)

    // Expect only 17 worth of ETH drawn
    const expectedTotalETHDrawn = fullfilledRedemptionAmount.sub(frontRunRedepmtion).div(toBN(200)) // redempted VST converted to ETH, at ETH:USD price 200
    const expectedTotalETHDrawn_Asset = fullfilledRedemptionAmount_Asset.sub(frontRunRedepmtion).div(toBN(200))

    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee)
    const expectedReceivedETH_Asset = expectedTotalETHDrawn_Asset.sub(ETHFee_Asset)

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)
    th.assertIsApproximatelyEqual(expectedReceivedETH_Asset.div(toBN(10 ** 10)), receivedETH_Asset)

    const dennis_VSTBalance_After = (await VSTToken.balanceOf(dennis)).toString()
    th.assertIsApproximatelyEqual(
      dennis_VSTBalance_After,
      dennis_VSTBalance_Before
        .sub(fullfilledRedemptionAmount.sub(frontRunRedepmtion))
        .sub(fullfilledRedemptionAmount_Asset.sub(frontRunRedepmtion)))
  })

  // active debt cannot be zero, as there’s a positive min debt enforced, and at least a trove must exist
  it.skip("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---

    const amount = await getOpenTroveVSTAmount(dec(110, 18))
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraVSTAmount: amount, extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraVSTAmount: amount, extraParams: { from: bob } })

    await VSTToken.transfer(carol, amount.mul(toBN(2)), { from: bob })

    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // Liquidate Bob's Trove
    await troveManager.liquidateTroves(ZERO_ADDRESS, 1)
    await troveManager.liquidateTroves(erc20.address, 1)

    // --- TEST --- 

    const carol_ETHBalance_Before = toBN(await web3.eth.getBalance(carol))
    const carol_ETHBalance_Before_Asset = toBN(await erc20.balanceOf(carol))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      amount,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '10367038690476190477',
      0,
      th._100pct,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
      amount,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '10367038690476190477',
      0,
      th._100pct,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]
    const ETHFee_Asset = th.getEmittedRedemptionValues(redemptionTx_Asset)[3]

    const carol_ETHBalance_After = toBN(await web3.eth.getBalance(carol))
    const carol_ETHBalance_After_Asset = toBN(await erc20.address(carol))

    const expectedTotalETHDrawn = toBN(amount).div(toBN(100)) // convert 100 VST to ETH at ETH:USD price of 100
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee)
    const expectedReceivedETH_Asset = expectedTotalETHDrawn.sub(ETHFee_Asset)

    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before)
    const receivedETH_Asset = carol_ETHBalance_After_Asset.sub(carol_ETHBalance_Before_Asset)
    assert.isTrue(expectedReceivedETH.eq(receivedETH))
    assert.isTrue(expectedReceivedETH_Asset.eq(receivedETH_Asset))

    const carol_VSTBalance_After = (await VSTToken.balanceOf(carol)).toString()
    assert.equal(carol_VSTBalance_After, '0')
  })
  it("redeemCollateral(): doesn't touch Troves with ICR < 110%", async () => {
    // --- SETUP ---

    const { netDebt: A_debt } = await openTrove({ ICR: toBN(dec(13, 18)), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(133, 16)), extraVSTAmount: A_debt, extraParams: { from: bob } })

    const { netDebt: A_debt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(13, 18)), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount_Asset, totalDebt: B_totalDebt_Asset }
      = await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraVSTAmount: A_debt, extraParams: { from: bob } })

    await VSTToken.transfer(carol, B_VSTAmount.add(B_VSTAmount_Asset), { from: bob })

    // Put Bob's Trove below 110% ICR
    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // --- TEST --- 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await troveManager.redeemCollateral(ZERO_ADDRESS,
      A_debt,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: carol }
    );

    await troveManager.redeemCollateral(erc20.address,
      A_debt_Asset,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: carol }
    );


    // Alice's Trove was cleared of debt
    const { debt: alice_Debt_After } = await troveManager.Troves(alice, ZERO_ADDRESS)
    assert.equal(alice_Debt_After, '0')

    const { debt: alice_Debt_After_Asset } = await troveManager.Troves(alice, erc20.address)
    assert.equal(alice_Debt_After_Asset, '0')

    // Bob's Trove was left untouched
    const { debt: bob_Debt_After } = await troveManager.Troves(bob, ZERO_ADDRESS)
    const { debt: bob_Debt_After_Asset } = await troveManager.Troves(bob, erc20.address)
    th.assertIsApproximatelyEqual(bob_Debt_After, B_totalDebt)
    th.assertIsApproximatelyEqual(bob_Debt_After_Asset, B_totalDebt_Asset)
  });

  it("redeemCollateral(): finds the last Trove with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---
    const amount1 = toBN(dec(100, 18))
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: amount1, extraParams: { from: carol } })

    const redemptionAmount = C_totalDebt.add(B_totalDebt).add(A_totalDebt)
    const redemptionAmount_Asset = C_totalDebt_Asset.add(B_totalDebt_Asset).add(A_totalDebt_Asset)
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(195, 16)), extraVSTAmount: redemptionAmount, extraParams: { from: dennis } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraVSTAmount: redemptionAmount_Asset, extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)

    const orderOfTroves = [];
    const orderOfTroves_Asset = [];
    let current = await sortedTroves.getFirst(ZERO_ADDRESS);
    let current_Asset = await sortedTroves.getFirst(erc20.address);

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfTroves.push(current);
      current = await sortedTroves.getNext(ZERO_ADDRESS, current);
    }

    while (current_Asset !== '0x0000000000000000000000000000000000000000') {
      orderOfTroves_Asset.push(current_Asset);
      current_Asset = await sortedTroves.getNext(erc20.address, current_Asset);
    }

    assert.deepEqual(orderOfTroves, [carol, bob, alice, dennis]);
    assert.deepEqual(orderOfTroves_Asset, [carol, bob, alice, dennis]);

    await openTrove({ ICR: toBN(dec(100, 18)), extraVSTAmount: dec(10, 18), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(100, 18)), extraVSTAmount: dec(10, 18), extraParams: { from: whale } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const tx = await troveManager.redeemCollateral(ZERO_ADDRESS,
      redemptionAmount,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last Trove with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: dennis }
    )

    const tx_Asset = await troveManager.redeemCollateral(erc20.address,
      redemptionAmount_Asset,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last Trove with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      th._100pct,
      { from: dennis }
    )

    const { debt: alice_Debt_After } = await troveManager.Troves(alice, ZERO_ADDRESS)
    assert.equal(alice_Debt_After, '0')

    const { debt: alice_Debt_After_Asset } = await troveManager.Troves(alice, erc20.address)
    assert.equal(alice_Debt_After_Asset, '0')

    const { debt: bob_Debt_After } = await troveManager.Troves(bob, ZERO_ADDRESS)
    assert.equal(bob_Debt_After, '0')

    const { debt: bob_Debt_After_Asset } = await troveManager.Troves(bob, erc20.address)
    assert.equal(bob_Debt_After_Asset, '0')

    const { debt: carol_Debt_After } = await troveManager.Troves(carol, ZERO_ADDRESS)
    assert.equal(carol_Debt_After, '0')

    const { debt: carol_Debt_After_Asset } = await troveManager.Troves(carol, erc20.address)
    assert.equal(carol_Debt_After_Asset, '0')

    const { debt: dennis_Debt_After } = await troveManager.Troves(dennis, ZERO_ADDRESS)
    th.assertIsApproximatelyEqual(dennis_Debt_After, D_totalDebt)

    const { debt: dennis_Debt_After_Asset } = await troveManager.Troves(dennis, erc20.address)
    th.assertIsApproximatelyEqual(dennis_Debt_After_Asset, D_totalDebt_Asset)
  });

  it("redeemCollateral(): reverts when TCR < MCR", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%

    await priceFeed.setPrice('110' + _18_zeros)
    const price = await priceFeed.getPrice()

    const TCR = (await th.getTCR(contracts))
    const TCR_Asset = (await th.getTCR(contracts, erc20.address))
    assert.isTrue(TCR.lt(toBN('1100000000000000000')))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await assertRevert(th.redeemCollateral(carol, contracts, dec(270, 18), ZERO_ADDRESS), "TroveManager: Cannot redeem when TCR < MCR")
    await assertRevert(th.redeemCollateral(carol, contracts, dec(270, 18), erc20.address), "TroveManager: Cannot redeem when TCR < MCR")
  });

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 500VST to Erin, the would-be redeemer
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: alice } })
    await VSTToken.transfer(erin, dec(500, 18), { from: alice })

    // B, C and D open troves
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = troveManager.redeemCollateral(ZERO_ADDRESS, 0, erin, erin, erin, 0, 0, th._100pct, { from: erin })
    const redemptionTxPromise_Asset = troveManager.redeemCollateral(erc20.address, 0, erin, erin, erin, 0, 0, th._100pct, { from: erin })
    await assertRevert(redemptionTxPromise, "TroveManager: Amount must be greater than zero")
    await assertRevert(redemptionTxPromise_Asset, "TroveManager: Amount must be greater than zero")
  })

  it("redeemCollateral(): reverts if max fee > 100%", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: D } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS, dec(2, 18)), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS, '1000000000000000001'), "Max fee percentage must be between 0.5% and 100%")

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address, dec(2, 18)), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address, '1000000000000000001'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if max fee < 0.5%", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: D } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS, 0), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS, 1), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS, '4999999999999999'), "Max fee percentage must be between 0.5% and 100%")

    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address, 0), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address, 1), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address, '4999999999999999'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if fee exceeds max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(80, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(90, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(80, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(90, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)
    const expectedTotalSupply_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset)

    // Check total VST supply
    const totalSupply = await VSTToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply.add(expectedTotalSupply_Asset))

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // VST redemption is 27 USD: a redemption that incurs a fee of 27/(270 * 2) = 5%
    const attemptedVSTRedemption = expectedTotalSupply.div(toBN(10))
    const attemptedVSTRedemption_Asset = expectedTotalSupply_Asset.div(toBN(10))

    // Max fee is <5%
    const lessThan5pct = '49999999999999999'
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, lessThan5pct), "Fee exceeded provided maximum")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, erc20.address, lessThan5pct), "Fee exceeded provided maximum")

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)  // artificially zero the baseRate
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 1%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(1, 16)), "Fee exceeded provided maximum")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, erc20.address, dec(1, 16)), "Fee exceeded provided maximum")

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 3.754%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(3754, 13)), "Fee exceeded provided maximum")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, erc20.address, dec(3754, 13)), "Fee exceeded provided maximum")

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 0.5%
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(5, 15)), "Fee exceeded provided maximum")
    await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, erc20.address, dec(5, 15)), "Fee exceeded provided maximum")
  })

  it("redeemCollateral(): succeeds if fee is less than max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(9500, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(395, 16)), extraVSTAmount: dec(9000, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(390, 16)), extraVSTAmount: dec(10000, 18), extraParams: { from: C } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(9500, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(395, 16)), extraVSTAmount: dec(9000, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(390, 16)), extraVSTAmount: dec(10000, 18), extraParams: { from: C } })

    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)
    const expectedTotalSupply_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset)

    // Check total VST supply
    const totalSupply = await VSTToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply.add(expectedTotalSupply_Asset))

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // VST redemption fee with 10% of the supply will be 0.5% + 1/(10*2)
    const attemptedVSTRedemption = expectedTotalSupply.div(toBN(10))
    const attemptedVSTRedemption_Asset = expectedTotalSupply_Asset.div(toBN(10))

    // Attempt with maxFee > 5.5%
    const price = await priceFeed.getPrice()
    const ETHDrawn = attemptedVSTRedemption.mul(mv._1e18BN).div(price)
    const ETHDrawn_Asset = attemptedVSTRedemption_Asset.mul(mv._1e18BN).div(price)

    const slightlyMoreThanFee = (await troveManager.getRedemptionFeeWithDecay(ZERO_ADDRESS, ETHDrawn))
    const slightlyMoreThanFee_Asset = (await troveManager.getRedemptionFeeWithDecay(erc20.address, ETHDrawn))
    const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, slightlyMoreThanFee)
    const tx1_Asset = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption_Asset, erc20.address, slightlyMoreThanFee_Asset)
    assert.isTrue(tx1.receipt.status)
    assert.isTrue(tx1_Asset.receipt.status)

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)  // Artificially zero the baseRate
    await troveManager.setBaseRate(erc20.address, 0)

    // Attempt with maxFee = 5.5%
    const exactSameFee = (await troveManager.getRedemptionFeeWithDecay(ZERO_ADDRESS, ETHDrawn))
    const exactSameFee_Asset = (await troveManager.getRedemptionFeeWithDecay(erc20.address, ETHDrawn_Asset))

    const tx2 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedVSTRedemption, ZERO_ADDRESS, exactSameFee)
    const tx2_Asset = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedVSTRedemption_Asset, erc20.address, exactSameFee_Asset)
    assert.isTrue(tx2.receipt.status)
    assert.isTrue(tx2_Asset.receipt.status)

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 10%
    const tx3 = await th.redeemCollateralAndGetTxObject(B, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(1, 17))
    const tx3_Asset = await th.redeemCollateralAndGetTxObject(B, contracts, attemptedVSTRedemption_Asset, erc20.address, dec(1, 17))
    assert.isTrue(tx3.receipt.status)
    assert.isTrue(tx3_Asset.receipt.status)

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 37.659%
    const tx4 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(37659, 13))
    const tx4_Asset = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedVSTRedemption_Asset, erc20.address, dec(37659, 13))
    assert.isTrue(tx4.receipt.status)
    assert.isTrue(tx4_Asset.receipt.status)

    await troveManager.setBaseRate(ZERO_ADDRESS, 0)
    await troveManager.setBaseRate(erc20.address, 0)

    // Max fee is 100%
    const tx5 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedVSTRedemption, ZERO_ADDRESS, dec(1, 18))
    const tx5_Asset = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedVSTRedemption_Asset, erc20.address, dec(1, 18))
    assert.isTrue(tx5.receipt.status)
    assert.isTrue(tx5_Asset.receipt.status)
  })

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // B, C, D, F open trove
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(195, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: dennis } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: flyn } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(195, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: dennis } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: flyn } })

    const redemptionAmount = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(F_totalDebt)
    const redemptionAmount_Asset = B_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(F_totalDebt_Asset)

    // Alice opens trove and transfers VST to Erin, the would-be redeemer
    await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: redemptionAmount, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: redemptionAmount_Asset, extraParams: { from: alice } })
    await VSTToken.transfer(erin, redemptionAmount.add(redemptionAmount_Asset), { from: alice })

    // B, C, D deposit some of their tokens to the Stability Pool
    await stabilityPool.provideToSP(dec(50, 18), { from: bob })
    await stabilityPool.provideToSP(dec(150, 18), { from: carol })
    await stabilityPool.provideToSP(dec(200, 18), { from: dennis })

    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: bob })
    await stabilityPoolERC20.provideToSP(dec(150, 18), { from: carol })
    await stabilityPoolERC20.provideToSP(dec(200, 18), { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const dennis_ICR_before = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)

    const bob_ICR_before_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const dennis_ICR_before_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, flyn))
    assert.isTrue(await sortedTroves.contains(erc20.address, flyn))

    // Liquidate Flyn
    await troveManager.liquidate(ZERO_ADDRESS, flyn)
    await troveManager.liquidate(erc20.address, flyn)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, flyn))
    assert.isFalse(await sortedTroves.contains(erc20.address, flyn))

    // Price bounces back, bringing B, C, D back above MCRw
    await priceFeed.setPrice(dec(200, 18))

    const bob_SPDeposit_before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
    const carol_SPDeposit_before = (await stabilityPool.getCompoundedVSTDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()

    const bob_SPDeposit_before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
    const carol_SPDeposit_before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(carol)).toString()
    const dennis_SPDeposit_before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()

    const bob_ETHGain_before = (await stabilityPool.getDepositorAssetGain(bob)).toString()
    const carol_ETHGain_before = (await stabilityPool.getDepositorAssetGain(carol)).toString()
    const dennis_ETHGain_before = (await stabilityPool.getDepositorAssetGain(dennis)).toString()

    const bob_ETHGain_before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()
    const carol_ETHGain_before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(carol)).toString()
    const dennis_ETHGain_before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()

    // Check the remaining VST and ETH in Stability Pool after liquidation is non-zero
    const VSTinSP = await stabilityPool.getTotalVSTDeposits()
    const ETHinSP = await stabilityPool.getAssetBalance()

    const VSTinSP_Asset = await stabilityPoolERC20.getTotalVSTDeposits()
    const ETHinSP_Asset = await stabilityPoolERC20.getAssetBalance()

    assert.isTrue(VSTinSP.gte(mv._zeroBN))
    assert.isTrue(ETHinSP.gte(mv._zeroBN))

    assert.isTrue(VSTinSP_Asset.gte(mv._zeroBN))
    assert.isTrue(ETHinSP_Asset.gte(mv._zeroBN))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin redeems VST
    await th.redeemCollateral(erin, contracts, redemptionAmount, ZERO_ADDRESS, th._100pct)
    await th.redeemCollateral(erin, contracts, redemptionAmount_Asset, erc20.address, th._100pct)

    price = await priceFeed.getPrice()
    const bob_ICR_after = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_after = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const dennis_ICR_after = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)

    const bob_ICR_after_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_after_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const dennis_ICR_after_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    assert.isTrue(bob_ICR_after_Asset.gte(bob_ICR_before_Asset))
    assert.isTrue(carol_ICR_after_Asset.gte(carol_ICR_before_Asset))
    assert.isTrue(dennis_ICR_after_Asset.gte(dennis_ICR_before_Asset))

    const bob_SPDeposit_after = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
    const carol_SPDeposit_after = (await stabilityPool.getCompoundedVSTDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()

    const bob_SPDeposit_after_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
    const carol_SPDeposit_after_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(carol)).toString()
    const dennis_SPDeposit_after_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()

    const bob_ETHGain_after = (await stabilityPool.getDepositorAssetGain(bob)).toString()
    const carol_ETHGain_after = (await stabilityPool.getDepositorAssetGain(carol)).toString()
    const dennis_ETHGain_after = (await stabilityPool.getDepositorAssetGain(dennis)).toString()

    const bob_ETHGain_after_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()
    const carol_ETHGain_after_Asset = (await stabilityPoolERC20.getDepositorAssetGain(carol)).toString()
    const dennis_ETHGain_after_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()

    // Check B, C, D Stability Pool deposits and ETH gain have not been affected by redemptions from their troves
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after)
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after)
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after)

    assert.equal(bob_SPDeposit_before_Asset, bob_SPDeposit_after_Asset)
    assert.equal(carol_SPDeposit_before_Asset, carol_SPDeposit_after_Asset)
    assert.equal(dennis_SPDeposit_before_Asset, dennis_SPDeposit_after_Asset)

    assert.equal(bob_ETHGain_before, bob_ETHGain_after)
    assert.equal(carol_ETHGain_before, carol_ETHGain_after)
    assert.equal(dennis_ETHGain_before, dennis_ETHGain_after)

    assert.equal(bob_ETHGain_before_Asset, bob_ETHGain_after_Asset)
    assert.equal(carol_ETHGain_before_Asset, carol_ETHGain_after_Asset)
    assert.equal(dennis_ETHGain_before_Asset, dennis_ETHGain_after_Asset)
  })

  it("redeemCollateral(): caller can redeem their entire VSTToken balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    const { collateral: W_coll_Asset, totalDebt: W_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 400 VST to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: alice } })
    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: alice } })
    await VSTToken.transfer(erin, toBN(dec(400, 18)).mul(toBN(2)), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await VSTToken.balanceOf(erin)
    assert.equal(erin_balance_before, toBN(dec(400, 18)).mul(toBN(2)).toString())

    // B, C, D open trove
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(500, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(500, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    const totalDebt_Asset = W_totalDebt_Asset.add(A_totalDebt_Asset).add(B_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset)
    const totalColl_Asset = W_coll_Asset.add(A_coll_Asset).add(B_coll_Asset).add(C_coll_Asset).add(D_coll_Asset)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getVSTDebt(ZERO_ADDRESS)
    const activePool_coll_before = await activePool.getAssetBalance(ZERO_ADDRESS)

    const activePool_debt_before_Asset = await activePool.getVSTDebt(erc20.address)
    const activePool_coll_before_Asset = await activePool.getAssetBalance(erc20.address)

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    th.assertIsApproximatelyEqual(activePool_debt_before_Asset, totalDebt_Asset)
    assert.equal(activePool_coll_before.toString(), totalColl)
    assert.equal(activePool_coll_before_Asset.toString(), totalColl_Asset)

    const price = await priceFeed.getPrice()

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin attempts to redeem 400 VST
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, dec(400, 18), price, 0)

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, dec(400, 18), price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      erin,
      erin
    )

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR,
      erin,
      erin
    )

    await troveManager.redeemCollateral(ZERO_ADDRESS,
      dec(400, 18),
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: erin })

    await troveManager.redeemCollateral(erc20.address,
      dec(400, 18),
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_Asset,
      lowerPartialRedemptionHint_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      { from: erin })

    // Check activePool debt reduced by  400 VST
    const activePool_debt_after = await activePool.getVSTDebt(ZERO_ADDRESS)
    assert.equal(activePool_debt_before.sub(activePool_debt_after), dec(400, 18))

    const activePool_debt_after_Asset = await activePool.getVSTDebt(erc20.address)
    assert.equal(activePool_debt_before_Asset.sub(activePool_debt_after_Asset), dec(400, 18))

    /* 
    Check ActivePool coll reduced by $400 worth of Ether: at ETH:USD price of $200, this should be 2 ETH.
    therefore remaining ActivePool ETH should be 198 
    */

    const activePool_coll_after = await activePool.getAssetBalance(ZERO_ADDRESS)
    const activePool_coll_after_Asset = await activePool.getAssetBalance(erc20.address)

    assert.equal(activePool_coll_after.toString(), activePool_coll_before.sub(toBN(dec(2, 18))))
    assert.equal(activePool_coll_after_Asset.toString(), activePool_coll_before_Asset.sub(toBN(dec(2, 18))))

    // Check Erin's balance after
    const erin_balance_after = (await VSTToken.balanceOf(erin)).toString()
    assert.equal(erin_balance_after, '0')
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's VST token balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    const { collateral: W_coll_Asset, totalDebt: W_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 400 VST to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: alice } })
    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: alice } })
    await VSTToken.transfer(erin, toBN(dec(400, 18)).mul(toBN(2)), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await VSTToken.balanceOf(erin)
    assert.equal(erin_balance_before, toBN(dec(400, 18)).mul(toBN(2)).toString())

    // B, C, D open trove
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(500, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(500, 16)), extraVSTAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalDebt_Asset = W_totalDebt_Asset.add(A_totalDebt_Asset).add(B_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)
    const totalColl_Asset = W_coll_Asset.add(A_coll_Asset).add(B_coll_Asset).add(C_coll_Asset).add(D_coll_Asset)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getVSTDebt(ZERO_ADDRESS)
    const activePool_coll_before = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()

    const activePool_debt_before_Asset = await activePool.getVSTDebt(erc20.address)
    const activePool_coll_before_Asset = (await activePool.getAssetBalance(erc20.address)).toString()

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    th.assertIsApproximatelyEqual(activePool_debt_before_Asset, totalDebt_Asset)
    assert.equal(activePool_coll_before, totalColl)
    assert.equal(activePool_coll_before_Asset, totalColl_Asset)

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintNICR

    let firstRedemptionHint_Asset
    let partialRedemptionHintNICR_Asset

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin tries to redeem 1000 VST
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, dec(1000, 18), price, 0))

      const { 0: upperPartialRedemptionHint_1, 1: lowerPartialRedemptionHint_1 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        dec(1000, 18),
        firstRedemptionHint,
        upperPartialRedemptionHint_1,
        lowerPartialRedemptionHint_1,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    try {

      ({
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, dec(1000, 18), price, 0))


      const { 0: upperPartialRedemptionHint_1_Asset, 1: lowerPartialRedemptionHint_1_Asset } = await sortedTroves.findInsertPosition(erc20.address,
        partialRedemptionHintNICR_Asset,
        erin,
        erin
      )

      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        dec(1000, 18),
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_1_Asset,
        lowerPartialRedemptionHint_1_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx_Asset.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }


    // Erin tries to redeem 801 VST
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, '801000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_2, 1: lowerPartialRedemptionHint_2 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        '801000000000000000000', firstRedemptionHint,
        upperPartialRedemptionHint_2,
        lowerPartialRedemptionHint_2,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)

    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    try {
      ({
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, '801000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_2_Asset, 1: lowerPartialRedemptionHint_2_Asset } = await sortedTroves.findInsertPosition(erc20.address,
        partialRedemptionHintNICR_Asset,
        erin,
        erin
      )

      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        '801000000000000000000',
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_2_Asset,
        lowerPartialRedemptionHint_2_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx_Asset.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    // Erin tries to redeem 239482309 VST
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, '239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_3, 1: lowerPartialRedemptionHint_3 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        '239482309000000000000000000', firstRedemptionHint,
        upperPartialRedemptionHint_3,
        lowerPartialRedemptionHint_3,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    try {
      ({
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, '239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_3_Asset, 1: lowerPartialRedemptionHint_3_Asset } = await sortedTroves.findInsertPosition(erc20.address,
        partialRedemptionHintNICR_Asset,
        erin,
        erin
      )

      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        '239482309000000000000000000',
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_3_Asset,
        lowerPartialRedemptionHint_3_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx_Asset.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    // Erin tries to redeem 2^256 - 1 VST
    const maxBytes32 = toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, '239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_4, 1: lowerPartialRedemptionHint_4 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        maxBytes32, firstRedemptionHint,
        upperPartialRedemptionHint_4,
        lowerPartialRedemptionHint_4,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }

    try {
      ({
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, '239482309000000000000000000', price, 0))

      const { 0: upperPartialRedemptionHint_4_Asset, 1: lowerPartialRedemptionHint_4_Asset } = await sortedTroves.findInsertPosition(erc20.address,
        partialRedemptionHintNICR_Asset,
        erin,
        erin
      )

      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        maxBytes32,
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_4_Asset,
        lowerPartialRedemptionHint_4_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: erin })

      assert.isFalse(redemptionTx_Asset.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's VST token balance")
    }
  })

  it("redeemCollateral(): value of issued ETH == face value of redeemed VST (assuming 1 VST has value of $1)", async () => {
    const { collateral: W_coll } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    const { collateral: W_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 1000 VST each to Erin, Flyn, Graham
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(4990, 18), extraParams: { from: alice } })
    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(4990, 18), extraParams: { from: alice } })

    await VSTToken.transfer(erin, toBN(dec(1000, 18)).mul(toBN(2)), { from: alice })
    await VSTToken.transfer(flyn, toBN(dec(1000, 18)).mul(toBN(2)), { from: alice })
    await VSTToken.transfer(graham, toBN(dec(1000, 18)).mul(toBN(2)), { from: alice })

    // B, C, D open trove
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1590, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(600, 16)), extraVSTAmount: dec(1090, 18), extraParams: { from: carol } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(800, 16)), extraVSTAmount: dec(1090, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(1590, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(600, 16)), extraVSTAmount: dec(1090, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(800, 16)), extraVSTAmount: dec(1090, 18), extraParams: { from: dennis } })

    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)
    const totalColl_Asset = W_coll_Asset.add(A_coll_Asset).add(B_coll_Asset).add(C_coll_Asset).add(D_coll_Asset)

    const price = await priceFeed.getPrice()

    const _120_VST = '120000000000000000000'
    const _373_VST = '373000000000000000000'
    const _950_VST = '950000000000000000000'

    // Check Ether in activePool
    const activeETH_0 = await activePool.getAssetBalance(ZERO_ADDRESS)
    const activeETH_0_Asset = await activePool.getAssetBalance(erc20.address)
    assert.equal(activeETH_0, totalColl.toString());
    assert.equal(activeETH_0_Asset, totalColl_Asset.toString());

    let firstRedemptionHint
    let partialRedemptionHintNICR

    let firstRedemptionHint_Asset
    let partialRedemptionHintNICR_Asset


    // Erin redeems 120 VST
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, _120_VST, price, 0))

    const { 0: upperPartialRedemptionHint_1, 1: lowerPartialRedemptionHint_1 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      erin,
      erin
    )

    await ({
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, _120_VST, price, 0))

    const { 0: upperPartialRedemptionHint_1_Asset, 1: lowerPartialRedemptionHint_1_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      erin,
      erin
    )


    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const redemption_1 = await troveManager.redeemCollateral(ZERO_ADDRESS,
      _120_VST,
      firstRedemptionHint,
      upperPartialRedemptionHint_1,
      lowerPartialRedemptionHint_1,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: erin })

    const redemption_1_Asset = await troveManager.redeemCollateral(erc20.address,
      _120_VST,
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_1_Asset,
      lowerPartialRedemptionHint_1_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      { from: erin })

    assert.isTrue(redemption_1.receipt.status);
    assert.isTrue(redemption_1_Asset.receipt.status);

    /* 120 VST redeemed.  Expect $120 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (120/200) = 0.6 ETH
    Total active ETH = 280 - 0.6 = 279.4 ETH */

    const activeETH_1 = await activePool.getAssetBalance(ZERO_ADDRESS)
    const activeETH_1_Asset = await activePool.getAssetBalance(erc20.address)
    assert.equal(activeETH_1.toString(), activeETH_0.sub(toBN(_120_VST).mul(mv._1e18BN).div(price)));
    assert.equal(activeETH_1_Asset.toString(), activeETH_0_Asset.sub(toBN(_120_VST).mul(mv._1e18BN).div(price)));

    // Flyn redeems 373 VST
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, _373_VST, price, 0))

    const { 0: upperPartialRedemptionHint_2, 1: lowerPartialRedemptionHint_2 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      flyn,
      flyn
    )

    const redemption_2 = await troveManager.redeemCollateral(ZERO_ADDRESS,
      _373_VST,
      firstRedemptionHint,
      upperPartialRedemptionHint_2,
      lowerPartialRedemptionHint_2,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: flyn })

    assert.isTrue(redemption_2.receipt.status);

    ({
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, _373_VST, price, 0))

    const { 0: upperPartialRedemptionHint_2_Asset, 1: lowerPartialRedemptionHint_2_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      flyn,
      flyn
    )

    const redemption_2_Asset = await troveManager.redeemCollateral(erc20.address,
      _373_VST,
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_2_Asset,
      lowerPartialRedemptionHint_2_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      { from: flyn })

    assert.isTrue(redemption_2_Asset.receipt.status);

    /* 373 VST redeemed.  Expect $373 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (373/200) = 1.865 ETH
    Total active ETH = 279.4 - 1.865 = 277.535 ETH */
    const activeETH_2 = await activePool.getAssetBalance(ZERO_ADDRESS)
    const activeETH_2_Asset = await activePool.getAssetBalance(erc20.address)
    assert.equal(activeETH_2.toString(), activeETH_1.sub(toBN(_373_VST).mul(mv._1e18BN).div(price)));
    assert.equal(activeETH_2_Asset.toString(), activeETH_1_Asset.sub(toBN(_373_VST).mul(mv._1e18BN).div(price)));

    // Graham redeems 950 VST
    ({
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, _950_VST, price, 0))

    const { 0: upperPartialRedemptionHint_3, 1: lowerPartialRedemptionHint_3 } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      graham,
      graham
    )

    const redemption_3 = await troveManager.redeemCollateral(ZERO_ADDRESS,
      _950_VST,
      firstRedemptionHint,
      upperPartialRedemptionHint_3,
      lowerPartialRedemptionHint_3,
      partialRedemptionHintNICR,
      0, th._100pct,
      { from: graham })

    assert.isTrue(redemption_3.receipt.status);

    ({
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, _950_VST, price, 0))

    const { 0: upperPartialRedemptionHint_3_Asset, 1: lowerPartialRedemptionHint_3_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      graham,
      graham
    )

    const redemption_3_Asset = await troveManager.redeemCollateral(erc20.address,
      _950_VST,
      firstRedemptionHint_Asset,
      upperPartialRedemptionHint_3_Asset,
      lowerPartialRedemptionHint_3_Asset,
      partialRedemptionHintNICR_Asset,
      0, th._100pct,
      { from: graham })

    assert.isTrue(redemption_3_Asset.receipt.status);

    /* 950 VST redeemed.  Expect $950 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (950/200) = 4.75 ETH
    Total active ETH = 277.535 - 4.75 = 272.785 ETH */
    const activeETH_3 = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
    const activeETH_3_Asset = (await activePool.getAssetBalance(erc20.address)).toString()
    assert.equal(activeETH_3.toString(), activeETH_2.sub(toBN(_950_VST).mul(mv._1e18BN).div(price)));
    assert.equal(activeETH_3_Asset.toString(), activeETH_2_Asset.sub(toBN(_950_VST).mul(mv._1e18BN).div(price)));
  })

  // it doesn’t make much sense as there’s now min debt enforced and at least one trove must remain active
  // the only way to test it is before any trove is opened
  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint VST to Bob
    await VSTToken.unprotectedMint(bob, toBN(dec(100, 18)).mul(toBN(2)))

    assert.equal((await VSTToken.balanceOf(bob)), toBN(dec(100, 18)).mul(toBN(2)).toString())

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, dec(100, 18), price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained VST
    try {
      await troveManager.redeemCollateral(ZERO_ADDRESS,
        dec(100, 18),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, dec(100, 18), price, 0)

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      bob,
      bob
    )

    try {
      await troveManager.redeemCollateral(erc20.address,
        dec(100, 18),
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_Asset,
        lowerPartialRedemptionHint_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    // --- SETUP --- illegally mint VST to Bob
    await VSTToken.unprotectedMint(bob, '202000000000000000000')

    assert.equal((await VSTToken.balanceOf(bob)), '202000000000000000000')

    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(1000, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(1000, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: dennis } })

    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(1000, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(1000, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: dennis } })

    const totalDebt = C_totalDebt.add(D_totalDebt)
    const totalDebt_Asset = C_totalDebt_Asset.add(D_totalDebt_Asset)

    th.assertIsApproximatelyEqual((await activePool.getVSTDebt(ZERO_ADDRESS)).toString(), totalDebt)
    th.assertIsApproximatelyEqual((await activePool.getVSTDebt(erc20.address)).toString(), totalDebt_Asset)

    const price = await priceFeed.getPrice()
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, '101000000000000000000', price, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(ZERO_ADDRESS,
      partialRedemptionHintNICR,
      bob,
      bob
    )

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, '101000000000000000000', price, 0)

    const { 0: upperPartialRedemptionHint_Asset, 1: lowerPartialRedemptionHint_Asset } = await sortedTroves.findInsertPosition(erc20.address,
      partialRedemptionHintNICR_Asset,
      bob,
      bob
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Bob attempts to redeem his ill-gotten 101 VST, from a system that has 100 VST outstanding debt
    try {
      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        totalDebt.add(toBN(dec(100, 18))),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    try {
      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        totalDebt_Asset.add(toBN(dec(100, 18))),
        firstRedemptionHint_Asset,
        upperPartialRedemptionHint_Asset,
        lowerPartialRedemptionHint_Asset,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }
  })

  // Redemption fees 
  it("redeemCollateral(): a redemption made when base rate is zero increases the base rate", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_balanceBefore = await VSTToken.balanceOf(A)

    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS,)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address,)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    assert.isTrue((await troveManager.baseRate(ZERO_ADDRESS)).gt(toBN('0')))
    assert.isTrue((await troveManager.baseRate(erc20.address)).gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    const A_balanceBefore = await VSTToken.balanceOf(A)
    const B_balanceBefore = await VSTToken.balanceOf(B)

    // A redeems 10 VST
    const redemptionTx_A = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), ZERO_ADDRESS)
    const redemptionTx_A_Asset = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), erc20.address)
    const timeStamp_A = await th.getTimestampFromTx(redemptionTx_A, web3)
    const timeStamp_A_Asset = await th.getTimestampFromTx(redemptionTx_A_Asset, web3)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    // B redeems 10 VST
    const redemptionTx_B = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18), ZERO_ADDRESS)
    const timeStamp_B = await th.getTimestampFromTx(redemptionTx_B, web3)

    const redemptionTx_B_Asset = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18), erc20.address)
    const timeStamp_B_Asset = await th.getTimestampFromTx(redemptionTx_B_Asset, web3)

    // Check B's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check negligible time difference (< 1 minute) between txs
    assert.isTrue(Number(timeStamp_B) - Number(timeStamp_A) < 60)
    assert.isTrue(Number(timeStamp_B_Asset) - Number(timeStamp_A_Asset) < 60)

    const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
    const baseRate_2_Asset = await troveManager.baseRate(erc20.address)

    // Check baseRate has again increased
    assert.isTrue(baseRate_2.gt(baseRate_1))
    assert.isTrue(baseRate_2_Asset.gt(baseRate_1_Asset))
  })

  it("redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation [ @skip-on-coverage ]", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_balanceBefore = await VSTToken.balanceOf(A)

    // A redeems 10 VST
    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address)

    // Check A's balance has decreased by 10 VST
    assert.equal(A_balanceBefore.sub(await VSTToken.balanceOf(A)).toString(), toBN(dec(10, 18)).mul(toBN(2)).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
    const lastFeeOpTime_1_Asset = await troveManager.lastFeeOperationTime(erc20.address)

    // 45 seconds pass
    th.fastForwardTime(45, web3.currentProvider)

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(1, 18), erc20.address)

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
    const lastFeeOpTime_2_Asset = await troveManager.lastFeeOperationTime(erc20.address)

    // Check that the last fee operation time did not update, as borrower A's 2nd redemption occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))
    assert.isTrue(lastFeeOpTime_2_Asset.eq(lastFeeOpTime_1_Asset))

    // 15 seconds passes
    th.fastForwardTime(15, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1_Asset).gte(3600))

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(1, 18), erc20.address)

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
    const lastFeeOpTime_3_Asset = await troveManager.lastFeeOperationTime(erc20.address)

    // Check that the last fee operation time DID update, as A's 2rd redemption occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    assert.isTrue(lastFeeOpTime_3_Asset.gt(lastFeeOpTime_1_Asset))
  })

  it("redeemCollateral(): a redemption made at zero base rate send a non-zero ETHFee to VSTA staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    // Check VSTA Staking contract balance before is zero
    const VSTAStakingBalance_Before = await web3.eth.getBalance(vstaStaking.address)
    const VSTAStakingBalance_Before_Asset = await erc20.balanceOf(vstaStaking.address)
    assert.equal(VSTAStakingBalance_Before, '0')
    assert.equal(VSTAStakingBalance_Before_Asset, '0')

    const A_balanceBefore = await VSTToken.balanceOf(A)

    // A redeems 10 VST
    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    // Check VSTA Staking contract balance after is non-zero
    const VSTAStakingBalance_After = toBN(await web3.eth.getBalance(vstaStaking.address))
    assert.isTrue(VSTAStakingBalance_After.gt(toBN('0')))

    const VSTAStakingBalance_After_Asset = toBN(await erc20.balanceOf(vstaStaking.address))
    assert.isTrue(VSTAStakingBalance_After_Asset.gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made at zero base increases the ETH-fees-per-VSTA-staked in VSTA Staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    // Check VSTA Staking ETH-fees-per-VSTA-staked before is zero
    assert.equal(await vstaStaking.F_ASSETS(ZERO_ADDRESS), '0')
    assert.equal(await vstaStaking.F_ASSETS(erc20.address), '0')

    const A_balanceBefore = await VSTToken.balanceOf(A)

    // A redeems 10 VST
    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    // Check VSTA Staking ETH-fees-per-VSTA-staked after is non-zero
    assert.isTrue((await vstaStaking.F_ASSETS(ZERO_ADDRESS)).gt('0'))
    assert.isTrue((await vstaStaking.F_ASSETS(erc20.address)).gt('0'))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate send a non-zero ETHFee to VSTA staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    const A_balanceBefore = await VSTToken.balanceOf(A)
    const B_balanceBefore = await VSTToken.balanceOf(B)

    // A redeems 10 VST
    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    const VSTAStakingBalance_Before = toBN(await web3.eth.getBalance(vstaStaking.address))
    const VSTAStakingBalance_Before_Asset = toBN(await erc20.balanceOf(vstaStaking.address))

    // B redeems 10 VST
    await th.redeemCollateral(B, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(B, contracts, dec(10, 18), erc20.address)

    // Check B's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    const VSTAStakingBalance_After = toBN(await web3.eth.getBalance(vstaStaking.address))
    const VSTAStakingBalance_After_Asset = toBN(await erc20.balanceOf(vstaStaking.address))

    // check VSTA Staking balance has increased
    assert.isTrue(VSTAStakingBalance_After.gt(VSTAStakingBalance_Before))
    assert.isTrue(VSTAStakingBalance_After_Asset.gt(VSTAStakingBalance_Before_Asset))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate increases ETH-per-VSTA-staked in the staking contract", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(ZERO_ADDRESS), '0')
    assert.equal(await troveManager.baseRate(erc20.address), '0')

    const A_balanceBefore = await VSTToken.balanceOf(A)
    const B_balanceBefore = await VSTToken.balanceOf(B)

    // A redeems 10 VST
    await th.redeemCollateral(A, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, dec(10, 18), erc20.address)

    // Check A's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
    assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

    // Check VSTA Staking ETH-fees-per-VSTA-staked before is zero
    const F_ETH_Before = await vstaStaking.F_ASSETS(ZERO_ADDRESS)
    const F_ETH_Before_Asset = await vstaStaking.F_ASSETS(erc20.address)

    // B redeems 10 VST
    await th.redeemCollateral(B, contracts, dec(10, 18), ZERO_ADDRESS)
    await th.redeemCollateral(B, contracts, dec(10, 18), erc20.address)

    // Check B's balance has decreased by 10 VST
    assert.equal(await VSTToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18)).mul(toBN(2))).toString())

    const F_ETH_After = await vstaStaking.F_ASSETS(ZERO_ADDRESS)
    const F_ETH_After_Asset = await vstaStaking.F_ASSETS(erc20.address)

    // check VSTA Staking balance has increased
    assert.isTrue(F_ETH_After.gt(F_ETH_Before))
    assert.isTrue(F_ETH_After_Asset.gt(F_ETH_Before_Asset))
  })

  it("redeemCollateral(): a redemption sends the ETH remainder (ETHDrawn - ETHFee) to the redeemer", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    const { totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const { totalDebt: W_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt)
    const totalDebt_Asset = W_totalDebt_Asset.add(A_totalDebt_Asset).add(B_totalDebt_Asset).add(C_totalDebt_Asset)

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const A_balanceBefore_Asset = toBN(await erc20.balanceOf(A))

    // Confirm baseRate before redemption is 0
    const baseRate = await troveManager.baseRate(ZERO_ADDRESS)
    assert.equal(baseRate, '0')

    const baseRate_Asset = await troveManager.baseRate(erc20.address)
    assert.equal(baseRate_Asset, '0')

    // Check total VST supply
    const activeVST = await activePool.getVSTDebt(ZERO_ADDRESS)
    const defaultVST = await defaultPool.getVSTDebt(ZERO_ADDRESS)

    const activeVST_Asset = await activePool.getVSTDebt(erc20.address)
    const defaultVST_Asset = await defaultPool.getVSTDebt(erc20.address)

    const totalVSTSupply = activeVST.add(defaultVST)
    const totalVSTSupply_Asset = activeVST_Asset.add(defaultVST_Asset)
    th.assertIsApproximatelyEqual(totalVSTSupply, totalDebt)
    th.assertIsApproximatelyEqual(totalVSTSupply_Asset, totalDebt_Asset)

    // A redeems 9 VST
    const redemptionAmount = toBN(dec(9, 18))
    await th.redeemCollateral(A, contracts, redemptionAmount, ZERO_ADDRESS)
    await th.redeemCollateral(A, contracts, redemptionAmount, erc20.address)

    /*
    At ETH:USD price of 200:
    ETHDrawn = (9 / 200) = 0.045 ETH
    ETHfee = (0.005 + (1/2) *( 9/260)) * ETHDrawn = 0.00100384615385 ETH
    ETHRemainder = 0.045 - 0.001003... = 0.0439961538462
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const A_balanceAfter_Asset = toBN(await erc20.balanceOf(A))

    // check A's ETH balance has increased by 0.045 ETH 
    const price = await priceFeed.getPrice()
    const ETHDrawn = redemptionAmount.mul(mv._1e18BN).div(price)

    th.assertIsApproximatelyEqual(
      A_balanceAfter.sub(A_balanceBefore),
      ETHDrawn.sub(
        toBN(dec(5, 15)).add(redemptionAmount.mul(mv._1e18BN).div(totalDebt).div(toBN(2)))
          .mul(ETHDrawn).div(mv._1e18BN)
      ),
      100000
    )

    th.assertIsApproximatelyEqual(
      A_balanceAfter_Asset.sub(A_balanceBefore_Asset),
      ETHDrawn.sub(
        toBN(dec(5, 15)).add(redemptionAmount.mul(mv._1e18BN).div(totalDebt_Asset).div(toBN(2)))
          .mul(ETHDrawn).div(mv._1e18BN)
      ).div(toBN(10 ** 10)),
      100000
    )
  })

  it("redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const { netDebt: W_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))
    const redemptionAmount_Asset = A_netDebt_Asset.add(B_netDebt_Asset).add(C_netDebt_Asset).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    const A_balanceBefore_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceBefore_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceBefore_Asset = toBN(await erc20.balanceOf(C))

    // whale redeems 360 VST.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount, ZERO_ADDRESS)
    await th.redeemCollateral(whale, contracts, redemptionAmount_Asset, erc20.address)

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    assert.isFalse(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    // Check D remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, D))
  })

  const redeemCollateral3Full1Partial = async () => {
    // time fast-forwards 1 year, and multisig stakes 1 VSTA
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
    await vstaStaking.stake(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt, collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt, collateral: B_coll } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt, collateral: C_coll } = await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const { netDebt: W_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt_Asset, collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt_Asset, collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt_Asset, collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))
    const redemptionAmount_Asset = A_netDebt_Asset.add(B_netDebt_Asset).add(C_netDebt_Asset).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))
    const D_balanceBefore = toBN(await web3.eth.getBalance(D))

    const A_balanceBefore_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceBefore_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceBefore_Asset = toBN(await erc20.balanceOf(C))
    const D_balanceBefore_Asset = toBN(await erc20.balanceOf(D))

    const A_collBefore = await troveManager.getTroveColl(ZERO_ADDRESS, A)
    const B_collBefore = await troveManager.getTroveColl(ZERO_ADDRESS, B)
    const C_collBefore = await troveManager.getTroveColl(ZERO_ADDRESS, C)
    const D_collBefore = await troveManager.getTroveColl(ZERO_ADDRESS, D)

    const A_collBefore_Asset = await troveManager.getTroveColl(erc20.address, A)
    const B_collBefore_Asset = await troveManager.getTroveColl(erc20.address, B)
    const C_collBefore_Asset = await troveManager.getTroveColl(erc20.address, C)
    const D_collBefore_Asset = await troveManager.getTroveColl(erc20.address, D)

    // Confirm baseRate before redemption is 0
    const baseRate = await troveManager.baseRate(ZERO_ADDRESS)
    assert.equal(baseRate, '0')

    const baseRate_Asset = await troveManager.baseRate(erc20.address)
    assert.equal(baseRate_Asset, '0')

    // whale redeems VST.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount, ZERO_ADDRESS)
    await th.redeemCollateral(whale, contracts, redemptionAmount, erc20.address)

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    assert.isFalse(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, D))

    /*
    At ETH:USD price of 200, with full redemptions from A, B, C:

    ETHDrawn from A = 100/200 = 0.5 ETH --> Surplus = (1-0.5) = 0.5
    ETHDrawn from B = 120/200 = 0.6 ETH --> Surplus = (1-0.6) = 0.4
    ETHDrawn from C = 130/200 = 0.65 ETH --> Surplus = (2-0.65) = 1.35
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))
    const D_balanceAfter = toBN(await web3.eth.getBalance(D))

    const A_balanceAfter_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceAfter_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceAfter_Asset = toBN(await erc20.balanceOf(C))
    const D_balanceAfter_Asset = toBN(await erc20.balanceOf(D))

    // Check A, B, C’s trove collateral balance is zero (fully redeemed-from troves)
    const A_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, A)
    const B_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, B)
    const C_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, C)

    const A_collAfter_Asset = await troveManager.getTroveColl(erc20.address, A)
    const B_collAfter_Asset = await troveManager.getTroveColl(erc20.address, B)
    const C_collAfter_Asset = await troveManager.getTroveColl(erc20.address, C)

    assert.isTrue(A_collAfter.eq(toBN(0)))
    assert.isTrue(B_collAfter.eq(toBN(0)))
    assert.isTrue(C_collAfter.eq(toBN(0)))

    assert.isTrue(A_collAfter_Asset.eq(toBN(0)))
    assert.isTrue(B_collAfter_Asset.eq(toBN(0)))
    assert.isTrue(C_collAfter_Asset.eq(toBN(0)))

    // check D's trove collateral balances have decreased (the partially redeemed-from trove)
    const D_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, D)
    assert.isTrue(D_collAfter.lt(D_collBefore))

    const D_collAfter_Asset = await troveManager.getTroveColl(erc20.address, D)
    assert.isTrue(D_collAfter_Asset.lt(D_collBefore_Asset))

    // Check A, B, C (fully redeemed-from troves), and D's (the partially redeemed-from trove) balance has not changed
    assert.isTrue(A_balanceAfter.eq(A_balanceBefore))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore))
    assert.isTrue(D_balanceAfter.eq(D_balanceBefore))

    assert.isTrue(A_balanceAfter_Asset.eq(A_balanceBefore_Asset))
    assert.isTrue(B_balanceAfter_Asset.eq(B_balanceBefore_Asset))
    assert.isTrue(C_balanceAfter_Asset.eq(C_balanceBefore_Asset))
    assert.isTrue(D_balanceAfter_Asset.eq(D_balanceBefore_Asset))

    // D is not closed, so cannot open trove
    await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(10, 18) }), 'BorrowerOps: Trove is active')
    await assertRevert(borrowerOperations.openTrove(erc20.address, dec(10, 18), th._100pct, 0, ZERO_ADDRESS, ZERO_ADDRESS, { from: D }), 'BorrowerOps: Trove is active')

    return {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
      A_netDebt_Asset, A_coll_Asset,
      B_netDebt_Asset, B_coll_Asset,
      C_netDebt_Asset, C_coll_Asset,
    }
  }

  it("redeemCollateral(): emits correct debt and coll values in each redeemed trove's TroveUpdated event", async () => {
    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { totalDebt: D_totalDebt, collateral: D_coll } = await openTrove({ ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const { netDebt: W_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraVSTAmount: dec(10000, 18), extraParams: { from: whale } })
    const { netDebt: A_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })
    const { totalDebt: D_totalDebt_Asset, collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: D } })

    const partialAmount = toBN(dec(15, 18))
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(partialAmount)
    const redemptionAmount_Asset = A_netDebt_Asset.add(B_netDebt_Asset).add(C_netDebt_Asset).add(partialAmount)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems VST.  Expect this to fully redeem A, B, C, and partially redeem 15 VST from D.
    const redemptionTx = await th.redeemCollateralAndGetTxObject(whale, contracts, redemptionAmount, ZERO_ADDRESS, th._100pct, { gasPrice: 0 })
    const redemptionTx_Asset = await th.redeemCollateralAndGetTxObject(whale, contracts, redemptionAmount, erc20.address, th._100pct, { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    assert.isFalse(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, D))
    assert.isTrue(await sortedTroves.contains(erc20.address, D))

    const troveUpdatedEvents = th.getAllEventsByName(redemptionTx, "TroveUpdated")
    const troveUpdatedEvents_Asset = th.getAllEventsByName(redemptionTx_Asset, "TroveUpdated")

    // Get each trove's emitted debt and coll 
    const [A_emittedDebt, A_emittedColl] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, A)
    const [B_emittedDebt, B_emittedColl] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, B)
    const [C_emittedDebt, C_emittedColl] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, C)
    const [D_emittedDebt, D_emittedColl] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, D)

    const [A_emittedDebt_Asset, A_emittedColl_Asset] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents_Asset, A)
    const [B_emittedDebt_Asset, B_emittedColl_Asset] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents_Asset, B)
    const [C_emittedDebt_Asset, C_emittedColl_Asset] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents_Asset, C)
    const [D_emittedDebt_Asset, D_emittedColl_Asset] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents_Asset, D)

    // Expect A, B, C to have 0 emitted debt and coll, since they were closed
    assert.equal(A_emittedDebt, '0')
    assert.equal(A_emittedColl, '0')
    assert.equal(B_emittedDebt, '0')
    assert.equal(B_emittedColl, '0')
    assert.equal(C_emittedDebt, '0')
    assert.equal(C_emittedColl, '0')

    assert.equal(A_emittedDebt_Asset, '0')
    assert.equal(A_emittedColl_Asset, '0')
    assert.equal(B_emittedDebt_Asset, '0')
    assert.equal(B_emittedColl_Asset, '0')
    assert.equal(C_emittedDebt_Asset, '0')
    assert.equal(C_emittedColl_Asset, '0')

    /* Expect D to have lost 15 debt and (at ETH price of 200) 15/200 = 0.075 ETH. 
    So, expect remaining debt = (85 - 15) = 70, and remaining ETH = 1 - 15/200 = 0.925 remaining. */
    const price = await priceFeed.getPrice()
    th.assertIsApproximatelyEqual(D_emittedDebt, D_totalDebt.sub(partialAmount))
    th.assertIsApproximatelyEqual(D_emittedColl, D_coll.sub(partialAmount.mul(mv._1e18BN).div(price)))

    th.assertIsApproximatelyEqual(D_emittedDebt_Asset, D_totalDebt_Asset.sub(partialAmount))
    th.assertIsApproximatelyEqual(D_emittedColl_Asset, D_coll_Asset.sub(partialAmount.mul(mv._1e18BN).div(price)))
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim", async () => {
    const {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
      A_netDebt_Asset, A_coll_Asset,
      B_netDebt_Asset, B_coll_Asset,
      C_netDebt_Asset, C_coll_Asset,
    } = await redeemCollateral3Full1Partial()

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    const A_balanceBefore_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceBefore_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceBefore_Asset = toBN(await erc20.balanceOf(C))

    // CollSurplusPool endpoint cannot be called directly
    await assertRevert(collSurplusPool.claimColl(ZERO_ADDRESS, A), 'CollSurplusPool: Caller is not Borrower Operations')
    await assertRevert(collSurplusPool.claimColl(erc20.address, A), 'CollSurplusPool: Caller is not Borrower Operations')

    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: C, gasPrice: 0 })

    await borrowerOperations.claimCollateral(erc20.address, { from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    const A_balanceAfter_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceAfter_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceAfter_Asset = toBN(await erc20.balanceOf(C))

    const price = await priceFeed.getPrice()

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_coll.sub(A_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_coll.sub(C_netDebt.mul(mv._1e18BN).div(price))))

    th.assertIsApproximatelyEqual(A_balanceAfter_Asset, A_balanceBefore_Asset.add(A_coll_Asset.sub(A_netDebt_Asset.mul(mv._1e18BN).div(price)).div(toBN(10 ** 10))))
    th.assertIsApproximatelyEqual(B_balanceAfter_Asset, B_balanceBefore_Asset.add(B_coll_Asset.sub(B_netDebt_Asset.mul(mv._1e18BN).div(price)).div(toBN(10 ** 10))))
    th.assertIsApproximatelyEqual(C_balanceAfter_Asset, C_balanceBefore_Asset.add(C_coll_Asset.sub(C_netDebt_Asset.mul(mv._1e18BN).div(price)).div(toBN(10 ** 10))))
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner after re-opening trove", async () => {
    const {
      A_netDebt, A_coll: A_collBefore,
      B_netDebt, B_coll: B_collBefore,
      C_netDebt, C_coll: C_collBefore,
      A_netDebt_Asset, A_coll_Asset: A_collBefore_Asset,
      B_netDebt_Asset, B_coll_Asset: B_collBefore_Asset,
      C_netDebt_Asset, C_coll_Asset: C_collBefore_Asset,
    } = await redeemCollateral3Full1Partial()

    const price = await priceFeed.getPrice()
    const A_surplus = A_collBefore.sub(A_netDebt.mul(mv._1e18BN).div(price))
    const B_surplus = B_collBefore.sub(B_netDebt.mul(mv._1e18BN).div(price))
    const C_surplus = C_collBefore.sub(C_netDebt.mul(mv._1e18BN).div(price))

    const A_surplus_Asset = A_collBefore_Asset.sub(A_netDebt_Asset.mul(mv._1e18BN).div(price))
    const B_surplus_Asset = B_collBefore_Asset.sub(B_netDebt_Asset.mul(mv._1e18BN).div(price))
    const C_surplus_Asset = C_collBefore_Asset.sub(C_netDebt_Asset.mul(mv._1e18BN).div(price))

    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: A } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(190, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: B } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: C } })

    const A_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, A)
    const B_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, B)
    const C_collAfter = await troveManager.getTroveColl(ZERO_ADDRESS, C)

    const A_collAfter_Asset = await troveManager.getTroveColl(erc20.address, A)
    const B_collAfter_Asset = await troveManager.getTroveColl(erc20.address, B)
    const C_collAfter_Asset = await troveManager.getTroveColl(erc20.address, C)

    assert.isTrue(A_collAfter.eq(A_coll))
    assert.isTrue(B_collAfter.eq(B_coll))
    assert.isTrue(C_collAfter.eq(C_coll))

    assert.isTrue(A_collAfter_Asset.eq(A_coll_Asset))
    assert.isTrue(B_collAfter_Asset.eq(B_coll_Asset))
    assert.isTrue(C_collAfter_Asset.eq(C_coll_Asset))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    const A_balanceBefore_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceBefore_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceBefore_Asset = toBN(await erc20.balanceOf(C))

    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: C, gasPrice: 0 })

    await borrowerOperations.claimCollateral(erc20.address, { from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    const A_balanceAfter_Asset = toBN(await erc20.balanceOf(A))
    const B_balanceAfter_Asset = toBN(await erc20.balanceOf(B))
    const C_balanceAfter_Asset = toBN(await erc20.balanceOf(C))

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_surplus))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_surplus))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_surplus))

    th.assertIsApproximatelyEqual(A_balanceAfter_Asset, A_balanceBefore_Asset.add(A_surplus_Asset.div(toBN(10 ** 10))))
    th.assertIsApproximatelyEqual(B_balanceAfter_Asset, B_balanceBefore_Asset.add(B_surplus_Asset.div(toBN(10 ** 10))))
    th.assertIsApproximatelyEqual(C_balanceAfter_Asset, C_balanceBefore_Asset.add(C_surplus_Asset.div(toBN(10 ** 10))))
  })

  it('redeemCollateral(): reverts if fee eats up all returned collateral', async () => {
    // --- SETUP ---
    const { VSTAmount } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(1, 24), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const { VSTAmount: VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(1, 24), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // keep redeeming until we get the base rate to the ceiling of 100%
    for (let i = 0; i < 2; i++) {
      // Find hints for redeeming
      const {
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, VSTAmount, price, 0)

      // Don't pay for gas, as it makes it easier to calculate the received Ether
      const redemptionTx = await troveManager.redeemCollateral(ZERO_ADDRESS,
        VSTAmount,
        firstRedemptionHint,
        ZERO_ADDRESS,
        alice,
        partialRedemptionHintNICR,
        0, th._100pct,
        {
          from: alice,
          gasPrice: 0
        }
      )

      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, VSTAmount, true, alice, alice, { from: alice, value: VSTAmount.mul(mv._1e18BN).div(price) })
    }

    for (let i = 0; i < 2; i++) {
      // Find hints for redeeming
      const {
        0: firstRedemptionHint_Asset,
        1: partialRedemptionHintNICR_Asset
      } = await hintHelpers.getRedemptionHints(erc20.address, VSTAmount_Asset, price, 0)

      // Don't pay for gas, as it makes it easier to calculate the received Ether
      const redemptionTx_Asset = await troveManager.redeemCollateral(erc20.address,
        VSTAmount_Asset,
        firstRedemptionHint_Asset,
        ZERO_ADDRESS,
        alice,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        {
          from: alice,
          gasPrice: 0
        }
      )

      await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
      await borrowerOperations.adjustTrove(erc20.address, VSTAmount_Asset.mul(mv._1e18BN).div(price), th._100pct, 0, VSTAmount_Asset, true, alice, alice, { from: alice })
    }

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(ZERO_ADDRESS, VSTAmount, price, 0)

    await assertRevert(
      troveManager.redeemCollateral(ZERO_ADDRESS,
        VSTAmount,
        firstRedemptionHint,
        ZERO_ADDRESS,
        alice,
        partialRedemptionHintNICR,
        0, th._100pct,
        {
          from: alice,
          gasPrice: 0
        }
      ),
      'TroveManager: Fee would eat up all returned collateral'
    )

    const {
      0: firstRedemptionHint_Asset,
      1: partialRedemptionHintNICR_Asset
    } = await hintHelpers.getRedemptionHints(erc20.address, VSTAmount_Asset, price, 0)

    await assertRevert(
      troveManager.redeemCollateral(erc20.address,
        VSTAmount_Asset,
        firstRedemptionHint_Asset,
        ZERO_ADDRESS,
        alice,
        partialRedemptionHintNICR_Asset,
        0, th._100pct,
        {
          from: alice,
          gasPrice: 0
        }
      ),
      'TroveManager: Fee would eat up all returned collateral'
    )

  })

  it("getPendingVSTDebtReward(): Returns 0 if there is no pending VSTDebt reward", async () => {
    // Make some troves
    const { totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: dec(100, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(20, 18)), extraVSTAmount: totalDebt, extraParams: { from: whale } })

    const { totalDebt: totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: dec(100, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraVSTAmount: totalDebt, extraParams: { from: whale } })

    await stabilityPool.provideToSP(totalDebt, { from: whale })
    await stabilityPoolERC20.provideToSP(totalDebt_Asset, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_VSTDebt = await troveManager.L_VSTDebts(ZERO_ADDRESS)
    assert.equal(current_L_VSTDebt, 0)

    const current_L_VSTDebt_Asset = await troveManager.L_VSTDebts(erc20.address)
    assert.equal(current_L_VSTDebt_Asset, 0)

    const carolSnapshot_L_VSTDebt = (await troveManager.rewardSnapshots(carol, ZERO_ADDRESS))[1]
    assert.equal(carolSnapshot_L_VSTDebt, 0)

    const carolSnapshot_L_VSTDebt_Asset = (await troveManager.rewardSnapshots(carol, erc20.address))[1]
    assert.equal(carolSnapshot_L_VSTDebt_Asset, 0)

    const carol_PendingVSTDebtReward = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, carol)
    assert.equal(carol_PendingVSTDebtReward, 0)

    const carol_PendingVSTDebtReward_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, carol)
    assert.equal(carol_PendingVSTDebtReward_Asset, 0)
  })

  it("getPendingETHReward(): Returns 0 if there is no pending ETH reward", async () => {
    // make some troves
    const { totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraVSTAmount: dec(100, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(20, 18)), extraVSTAmount: totalDebt, extraParams: { from: whale } })

    const { totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraVSTAmount: dec(100, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraVSTAmount: dec(20, 18), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(20, 18)), extraVSTAmount: totalDebt, extraParams: { from: whale } })

    await stabilityPool.provideToSP(totalDebt, { from: whale })
    await stabilityPoolERC20.provideToSP(totalDebt, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
    assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_ETH = await troveManager.L_ASSETS(ZERO_ADDRESS)
    assert.equal(current_L_ETH, 0)

    const carolSnapshot_L_ETH = (await troveManager.rewardSnapshots(carol, ZERO_ADDRESS))[0]
    assert.equal(carolSnapshot_L_ETH, 0)

    const carol_PendingETHReward = await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)
    assert.equal(carol_PendingETHReward, 0)

    const current_L_ETH_Asset = await troveManager.L_ASSETS(erc20.address)
    assert.equal(current_L_ETH_Asset, 0)

    const carolSnapshot_L_ETH_Asset = (await troveManager.rewardSnapshots(carol, erc20.address))[0]
    assert.equal(carolSnapshot_L_ETH_Asset, 0)

    const carol_PendingETHReward_Asset = await troveManager.getPendingAssetReward(erc20.address, carol)
    assert.equal(carol_PendingETHReward_Asset, 0)
  })

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    const price = 0
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 VST", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, dec(1, 18))
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 VST", async () => {
    const price = dec(100, 18)
    const coll = dec(200, 'ether')
    const debt = dec(30, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 VST", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    const ICR = (await troveManager.computeICR(coll, debt, price))

    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 VST", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = '54321000000000000000000'

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })


  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = 0

    const ICR = web3.utils.toHex(await troveManager.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await th.getTCR(contracts))
    const TCR_Asset = (await th.getTCR(contracts, erc20.address))

    assert.isTrue(TCR.lte(toBN('1500000000000000000')))
    assert.isTrue(TCR_Asset.lte(toBN('1500000000000000000')))

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts))
    const TCR_Asset = (await th.getTCR(contracts, erc20.address))

    assert.equal(TCR, '1500000000000000000')
    assert.equal(TCR_Asset, '1500000000000000000')

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await th.getTCR(contracts))
    const TCR_Asset = (await th.getTCR(contracts, erc20.address))

    assert.isTrue(TCR.gte(toBN('1500000000000000000')))
    assert.isTrue(TCR_Asset.gte(toBN('1500000000000000000')))

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice(0)

    const TCR = (await th.getTCR(contracts)).toString()
    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()

    assert.equal(TCR, 0)
    assert.equal(TCR_Asset, 0)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
  })

  // --- Getters ---

  it("getTroveStake(): Returns stake", async () => {
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Stake = await troveManager.getTroveStake(ZERO_ADDRESS, A)
    const B_Stake = await troveManager.getTroveStake(ZERO_ADDRESS, B)

    const A_Stake_Asset = await troveManager.getTroveStake(erc20.address, A)
    const B_Stake_Asset = await troveManager.getTroveStake(erc20.address, B)

    assert.equal(A_Stake, A_coll.toString())
    assert.equal(B_Stake, B_coll.toString())

    assert.equal(A_Stake_Asset, A_coll_Asset.toString())
    assert.equal(B_Stake_Asset, B_coll_Asset.toString())
  })

  it("getTroveColl(): Returns coll", async () => {
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    assert.equal(await troveManager.getTroveColl(ZERO_ADDRESS, A), A_coll.toString())
    assert.equal(await troveManager.getTroveColl(ZERO_ADDRESS, B), B_coll.toString())

    assert.equal(await troveManager.getTroveColl(erc20.address, A), A_coll.toString())
    assert.equal(await troveManager.getTroveColl(erc20.address, B), B_coll.toString())
  })

  it("getTroveDebt(): Returns debt", async () => {
    const { totalDebt: totalDebtA } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { totalDebt: totalDebtB } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const { totalDebt: totalDebtA_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { totalDebt: totalDebtB_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, A)
    const B_Debt = await troveManager.getTroveDebt(ZERO_ADDRESS, B)

    const A_Debt_Asset = await troveManager.getTroveDebt(erc20.address, A)
    const B_Debt_Asset = await troveManager.getTroveDebt(erc20.address, B)

    // Expect debt = requested + 0.5% fee + 50 (due to gas comp)

    assert.equal(A_Debt, totalDebtA.toString())
    assert.equal(B_Debt, totalDebtB.toString())

    assert.equal(A_Debt_Asset, totalDebtA_Asset.toString())
    assert.equal(B_Debt_Asset, totalDebtB_Asset.toString())
  })

  it("getTroveStatus(): Returns status", async () => {
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: A } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: A } })

    // to be able to repay:
    await VSTToken.transfer(B, B_totalDebt, { from: A })
    await VSTToken.transfer(B, B_totalDebt_Asset, { from: A })

    await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: B })
    await borrowerOperations.closeTrove(erc20.address, { from: B })

    const A_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, A)
    const B_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, B)
    const C_Status = await troveManager.getTroveStatus(ZERO_ADDRESS, C)

    const A_Status_Asset = await troveManager.getTroveStatus(erc20.address, A)
    const B_Status_Asset = await troveManager.getTroveStatus(erc20.address, B)
    const C_Status_Asset = await troveManager.getTroveStatus(erc20.address, C)

    assert.equal(A_Status, '1')  // active
    assert.equal(B_Status, '2')  // closed by user
    assert.equal(C_Status, '0')  // non-existent

    assert.equal(A_Status_Asset, '1')  // active
    assert.equal(B_Status_Asset, '2')  // closed by user
    assert.equal(C_Status_Asset, '0')  // non-existent
  })

  it("hasPendingRewards(): Returns false it trove is not active", async () => {
    assert.isFalse(await troveManager.hasPendingRewards(ZERO_ADDRESS, alice))
    assert.isFalse(await troveManager.hasPendingRewards(erc20.address, alice))
  })
})

contract('Reset chain state', async accounts => { })
