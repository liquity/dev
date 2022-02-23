const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const SortedTroves = artifacts.require("SortedTroves")
const SortedTrovesTester = artifacts.require("SortedTrovesTester")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const VSTTokenTester = artifacts.require("VSTTokenTester")


const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues

contract('SortedTroves', async accounts => {
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeedTestnet.getPrice()

    let trove = await contracts.sortedTroves.getLast()
    while (trove !== (await contracts.sortedTroves.getFirst(ZERO_ADDRESS))) {

      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(ZERO_ADDRESS, trove)

      const troveICR = await contracts.troveManager.getCurrentICR(ZERO_ADDRESS, trove, price)
      const prevTroveICR = await contracts.troveManager.getCurrentICR(ZERO_ADDRESS, prevTrove, price)

      assert.isTrue(prevTroveICR.gte(troveICR))

      const troveNICR = await contracts.troveManager.getNominalICR(ZERO_ADDRESS, trove)
      const prevTroveNICR = await contracts.troveManager.getNominalICR(ZERO_ADDRESS, prevTrove)

      assert.isTrue(prevTroveNICR.gte(troveNICR))

      // climb the list
      trove = prevTrove
    }
  }

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I, J, whale] = accounts;

  let priceFeed
  let sortedTroves
  let troveManager
  let borrowerOperations
  let vstToken

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)

  describe('SortedTroves', () => {
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
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      vstToken = contracts.vstToken

      await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
      await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)
    })

    it('contains(): returns true for addresses that have opened troves', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm trove statuses became active
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')

      // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    })

    it('contains(): returns false for addresses that have not opened troves', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm troves have non-existent status
      assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '0')
      assert.equal((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '0')

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    })

    it('contains(): returns false for addresses that opened and then closed a trove', async () => {
      await openTrove({ ICR: toBN(dec(1000, 18)), extraVSTAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await vstToken.transfer(alice, dec(1000, 18), { from: whale })
      await vstToken.transfer(bob, dec(1000, 18), { from: whale })
      await vstToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: bob })
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    })

    // true for addresses that opened -> closed -> opened a trove
    it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
      await openTrove({ ICR: toBN(dec(1000, 18)), extraVSTAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await vstToken.transfer(alice, dec(1000, 18), { from: whale })
      await vstToken.transfer(bob, dec(1000, 18), { from: whale })
      await vstToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: bob })
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '2')

      await openTrove({ ICR: toBN(dec(1000, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(3000, 18)), extraParams: { from: carol } })

      // Confirm trove statuses became open again
      assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
      assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    })

    // true when list size is 1 and the trove the only one in system
    it('contains(): true when list size is 1 and the trove the only one in system', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    })

    // false when list size is 1 and trove is not in the system
    it('contains(): false when list size is 1 and trove is not in the system', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize(ZERO_ADDRESS)
      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // NICR sorted in descending order
      await openTrove({ ICR: toBN(dec(500, 18)), extraParams: { from: whale } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: A } })
      await openTrove({ ICR: toBN(dec(5, 18)), extraParams: { from: B } })
      await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: C } })
      await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: D } })
      await openTrove({ ICR: toBN(dec(125, 16)), extraParams: { from: E } })

      // Expect a trove with NICR 300% to be inserted between B and C
      const targetNICR = dec(3, 18)

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedTroves.findInsertPosition(ZERO_ADDRESS, targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], C)

      // The price doesn’t affect the hints
      await priceFeed.setPrice(dec(500, 18))
      const hints2 = await sortedTroves.findInsertPosition(ZERO_ADDRESS, targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints2[0], B)
      assert.equal(hints2[1], C)
    })

    //--- Ordering --- 
    // infinte ICR (zero collateral) is not possible anymore, therefore, skipping
    it.skip("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

      // make several troves with 0 debt and collateral, in random order
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, whale, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, A, A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, B, B, { from: B, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, C, C, { from: C, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, D, D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, E, E, { from: E, value: dec(19, 'ether') })

      // Make some troves with non-zero debt, in random order
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(5, 19), F, F, { from: F, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(3, 18), G, G, { from: G, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(2, 20), H, H, { from: H, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(17, 18), I, I, { from: I, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(5, 21), J, J, { from: J, value: dec(1345, 'ether') })

      const price_1 = await priceFeed.getPrice()

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(100, 18), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price_2 = await priceFeed.getPrice()

      // Liquidate a trove
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedTroves with mock dependencies', () => {
    let sortedTrovesTester

    beforeEach(async () => {
      sortedTroves = await SortedTroves.new()
      sortedTrovesTester = await SortedTrovesTester.new()

      await sortedTroves.setParams(sortedTrovesTester.address, sortedTrovesTester.address)
      await sortedTrovesTester.setSortedTroves(sortedTroves.address)
    })



    context('when params are properly set', () => {
      it('insert(): fails if list already contains the node', async () => {
        await sortedTrovesTester.insert(ZERO_ADDRESS, alice, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.insert(ZERO_ADDRESS, alice, 1, alice, alice), 'SortedTroves: List already contains the node')
      })

      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(ZERO_ADDRESS, th.ZERO_ADDRESS, 1, alice, alice), 'SortedTroves: Id cannot be zero')
      })

      it('insert(): fails if NICR is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(ZERO_ADDRESS, alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedTrovesTester.remove(ZERO_ADDRESS, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedTrovesTester.reInsert(ZERO_ADDRESS, alice, 1, alice, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if new NICR is zero', async () => {
        await sortedTrovesTester.insert(ZERO_ADDRESS, alice, 1, alice, alice)
        assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice), 'list should contain element')
        await th.assertRevert(sortedTrovesTester.reInsert(ZERO_ADDRESS, alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
        assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice), 'list should contain element')
      })

      it('findInsertPosition(ZERO_ADDRESS,): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedTrovesTester.insert(ZERO_ADDRESS, alice, 1, alice, alice)
        const pos = await sortedTroves.findInsertPosition(ZERO_ADDRESS, 1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], ZERO_ADDRESS, 'nextId result should be zero')
      })
    })
  })
})
