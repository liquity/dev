const deploymentHelper = require("../../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../../utils/testHelpers.js")
const { toBN, dec, ZERO_ADDRESS } = th

const TroveManagerTester = artifacts.require("./TroveManagerTester")
const VSTTokenTester = artifacts.require("VSTTokenTester")
const StabilityPool = artifacts.require('StabilityPool.sol')

contract('TroveManager - in Recovery Mode - back to normal mode in 1 tx', async accounts => {
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I
  ] = accounts;

  let contracts
  let troveManager
  let stabilityPool
  let priceFeed
  let sortedTroves
  let stabilityPoolERC20
  let erc20

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

    troveManager = contracts.troveManager
    priceFeed = contracts.priceFeedTestnet
    sortedTroves = contracts.sortedTroves
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
    stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
    stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
  })

  context('Batch liquidations', () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(296, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraParams: { from: bob } })
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(296, 16)), extraParams: { from: alice } })
      const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraParams: { from: bob } })
      const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)
      const totalLiquidatedDebt_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset)

      await openTrove({ ICR: toBN(dec(340, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(340, 16)), extraVSTAmount: totalLiquidatedDebt_Asset, extraParams: { from: whale } })
      await stabilityPool.provideToSP(totalLiquidatedDebt, { from: whale })
      await stabilityPoolERC20.provideToSP(totalLiquidatedDebt_Asset, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)
      const TCR_Asset = await th.getTCR(contracts, erc20.address)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
      const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
      const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
      assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
      assert.isTrue(ICR_C_Asset.lt(mv._ICR100))

      return {
        A_coll, A_totalDebt,
        B_coll, B_totalDebt,
        C_coll, C_totalDebt,
        totalLiquidatedDebt,
        A_coll_Asset, A_totalDebt_Asset,
        B_coll_Asset, B_totalDebt_Asset,
        C_coll_Asset, C_totalDebt_Asset,
        totalLiquidatedDebt_Asset,
        price,
      }
    }

    it('First trove only doesn’t get out of Recovery Mode', async () => {
      await setup()
      await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [alice])
      await troveManager.batchLiquidateTroves(erc20.address, [alice])

      await th.getTCR(contracts)
      await th.getTCR(contracts, erc20.address)
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [alice, bob, carol])
      const tx_Asset = await troveManager.batchLiquidateTroves(erc20.address, [alice, bob, carol])

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      const liquidationEvents_Asset = th.getAllEventsByName(tx_Asset, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 3, 'Not enough liquidations')
      assert.equal(liquidationEvents_Asset.length, 3, 'Not enough liquidations')

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

      assert.isFalse(await sortedTroves.contains(erc20.address, alice))
      assert.isFalse(await sortedTroves.contains(erc20.address, bob))
      assert.isFalse(await sortedTroves.contains(erc20.address, carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')

      assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    })

    it('Stability Pool profit matches', async () => {
      const {
        A_coll, A_totalDebt,
        C_coll, C_totalDebt,
        totalLiquidatedDebt,
        A_coll_Asset, A_totalDebt_Asset,
        C_coll_Asset, C_totalDebt_Asset,
        totalLiquidatedDebt_Asset,
        price,
      } = await setup()

      const spEthBefore = await stabilityPool.getAssetBalance()
      const spVSTBefore = await stabilityPool.getTotalVSTDeposits()

      const spEthBefore_Asset = await stabilityPoolERC20.getAssetBalance()
      const spVSTBefore_Asset = await stabilityPoolERC20.getTotalVSTDeposits()

      const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [alice, carol])
      const txAsset = await troveManager.batchLiquidateTroves(erc20.address, [alice, carol])

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

      assert.isFalse(await sortedTroves.contains(erc20.address, alice))
      assert.isFalse(await sortedTroves.contains(erc20.address, carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')

      assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX], '3')

      const spEthAfter = await stabilityPool.getAssetBalance()
      const spVSTAfter = await stabilityPool.getTotalVSTDeposits()

      const spEthAfter_Asset = await stabilityPoolERC20.getAssetBalance()
      const spVSTAfter_Asset = await stabilityPoolERC20.getTotalVSTDeposits()

      // liquidate collaterals with the gas compensation fee subtracted
      const expectedCollateralLiquidatedA = th.applyLiquidationFee(A_totalDebt.mul(mv._MCR).div(price))
      const expectedCollateralLiquidatedC = th.applyLiquidationFee(C_coll)
      const expectedCollateralLiquidatedA_Asset = th.applyLiquidationFee(A_totalDebt_Asset.mul(mv._MCR).div(price))
      const expectedCollateralLiquidatedC_Asset = th.applyLiquidationFee(C_coll_Asset)
      // Stability Pool gains
      const expectedGainInVST = expectedCollateralLiquidatedA.mul(price).div(mv._1e18BN).sub(A_totalDebt)
      const realGainInVST = spEthAfter.sub(spEthBefore).mul(price).div(mv._1e18BN).sub(spVSTBefore.sub(spVSTAfter))

      const expectedGainInVST_Asset = expectedCollateralLiquidatedA_Asset.mul(price).div(mv._1e18BN).sub(A_totalDebt_Asset)
      const realGainInVST_Asset = spEthAfter_Asset.sub(spEthBefore_Asset).mul(price).div(mv._1e18BN).sub(spVSTBefore_Asset.sub(spVSTAfter_Asset))

      assert.equal(spEthAfter.sub(spEthBefore).toString(), expectedCollateralLiquidatedA.toString(), 'Stability Pool ETH doesn’t match')
      assert.equal(spVSTBefore.sub(spVSTAfter).toString(), A_totalDebt.toString(), 'Stability Pool VST doesn’t match')
      assert.equal(realGainInVST.toString(), expectedGainInVST.toString(), 'Stability Pool gains don’t match')

      assert.equal(spEthAfter_Asset.sub(spEthBefore_Asset).toString(), expectedCollateralLiquidatedA_Asset.toString(), 'Stability Pool ETH doesn’t match')
      assert.equal(spVSTBefore_Asset.sub(spVSTAfter_Asset).toString(), A_totalDebt_Asset.toString(), 'Stability Pool VST doesn’t match')
      assert.equal(realGainInVST_Asset.toString(), expectedGainInVST_Asset.toString(), 'Stability Pool gains don’t match')
    })

    it('A trove over TCR is not liquidated', async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(276, 16)), extraParams: { from: bob } })
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraParams: { from: alice } })
      const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(276, 16)), extraParams: { from: bob } })
      const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)
      const totalLiquidatedDebt_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset)

      await openTrove({ ICR: toBN(dec(310, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(310, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await stabilityPool.provideToSP(totalLiquidatedDebt, { from: whale })
      await stabilityPoolERC20.provideToSP(totalLiquidatedDebt_Asset, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)
      const TCR_Asset = await th.getTCR(contracts, erc20.address)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
      const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
      const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

      assert.isTrue(ICR_A.gt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      assert.isTrue(ICR_A_Asset.gt(TCR_Asset))
      assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
      assert.isTrue(ICR_C_Asset.lt(mv._ICR100))

      const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [bob, alice])
      const tx_Asset = await troveManager.batchLiquidateTroves(erc20.address, [bob, alice])

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      const liquidationEvents_Asset = th.getAllEventsByName(tx_Asset, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 1, 'Not enough liquidations')
      assert.equal(liquidationEvents_Asset.length, 1, 'Not enough liquidations')

      // Confirm only Bob’s trove removed
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))

      assert.isTrue(await sortedTroves.contains(erc20.address, alice))
      assert.isFalse(await sortedTroves.contains(erc20.address, bob))
      assert.isTrue(await sortedTroves.contains(erc20.address, carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
      // Confirm troves have status 'open' (Status enum element idx 1)
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')

      assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX], '1')
    })
  })

  context('Sequential liquidations', () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(299, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(298, 16)), extraParams: { from: bob } })

      const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(299, 16)), extraParams: { from: alice } })
      const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(298, 16)), extraParams: { from: bob } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt)
      const totalLiquidatedDebt_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset)

      await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await stabilityPool.provideToSP(totalLiquidatedDebt, { from: whale })
      await stabilityPoolERC20.provideToSP(totalLiquidatedDebt_Asset, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)
      const TCR_Asset = await th.getTCR(contracts, erc20.address)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)

      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))

      assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
      assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))

      return {
        A_coll, A_totalDebt,
        B_coll, B_totalDebt,
        totalLiquidatedDebt,
        A_coll_Asset, A_totalDebt_Asset,
        B_coll_Asset, B_totalDebt_Asset,
        totalLiquidatedDebt_Asset,
        price,
      }
    }

    it('First trove only doesn’t get out of Recovery Mode', async () => {
      await setup()
      await troveManager.liquidateTroves(ZERO_ADDRESS, 1)

      await th.getTCR(contracts)
      await th.getTCR(contracts, erc20.address)
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
      const tx_Asset = await troveManager.liquidateTroves(erc20.address, 10)

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      const liquidationEvents_Asset = th.getAllEventsByName(tx_Asset, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 2, 'Not enough liquidations')
      assert.equal(liquidationEvents_Asset.length, 2, 'Not enough liquidations')

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

      assert.isFalse(await sortedTroves.contains(erc20.address, alice))
      assert.isFalse(await sortedTroves.contains(erc20.address, bob))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')

      assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX], '3')
      assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    })
  })
})
