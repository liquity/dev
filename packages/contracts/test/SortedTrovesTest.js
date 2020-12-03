const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const SortedTroves = artifacts.require("SortedTroves")
const SortedTrovesTester = artifacts.require("SortedTrovesTester")

const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues

contract('SortedTroves', async accounts => {
  
  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeedTestnet.getPrice()

    let trove = await contracts.sortedTroves.getLast()
    while (trove !== (await contracts.sortedTroves.getFirst())) {
      
      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(trove)
     
      const troveICR = await contracts.troveManager.getCurrentICR(trove, price)
      const prevTroveICR = await contracts.troveManager.getCurrentICR(prevTrove, price)
      
      assert.isTrue(prevTroveICR.gte(troveICR))

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

  let contracts

  describe('SortedTroves', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const LQTYContracts = await deploymentHelper.deployLQTYContracts()

      priceFeed = contracts.priceFeedTestnet
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
    })

    it('contains(): returns true for addresses that have opened troves', async () => {
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(5, 'ether') })
      await borrowerOperations.openTrove('98908089089', carol, { from: carol, value: '23082308092385098009809' })

      // Confirm trove statuses became active
      assert.equal((await troveManager.Troves(alice))[3], '1')
      assert.equal((await troveManager.Troves(bob))[3], '1')
      assert.equal((await troveManager.Troves(carol))[3], '1')

      // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    it('contains(): returns false for addresses that have not opened troves', async () => {
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(5, 'ether') })
      await borrowerOperations.openTrove('98908089089', carol, { from: carol, value: '23082308092385098009809' })

      // Confirm troves have non-existent status
      assert.equal((await troveManager.Troves(dennis))[3], '0')
      assert.equal((await troveManager.Troves(erin))[3], '0')

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(dennis))
      assert.isFalse(await sortedTroves.contains(erin))
    })

    it('contains(): returns false for addresses that opened and then closed a trove', async () => {
      await borrowerOperations.openTrove('0', whale, { from: whale, value: dec(100, 'ether') })
      
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(5, 'ether') })
      await borrowerOperations.openTrove('98908089089', carol, { from: carol, value: '23082308092385098009809' })

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice })
      await borrowerOperations.closeTrove({ from:bob })
      await borrowerOperations.closeTrove({ from:carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice))[3], '2')
      assert.equal((await troveManager.Troves(bob))[3], '2')
      assert.equal((await troveManager.Troves(carol))[3], '2')

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true for addresses that opened -> closed -> opened a trove
    it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
      await borrowerOperations.openTrove('0', whale, { from: whale, value: dec(100, 'ether') })
      
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(5, 'ether') })
      await borrowerOperations.openTrove('98908089089', carol, { from: carol, value: '23082308092385098009809' })

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice })
      await borrowerOperations.closeTrove({ from:bob })
      await borrowerOperations.closeTrove({ from:carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice))[3], '2')
      assert.equal((await troveManager.Troves(bob))[3], '2')
      assert.equal((await troveManager.Troves(carol))[3], '2')

      await borrowerOperations.openTrove('234234', alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openTrove('9999', bob, { from: bob, value: dec(5, 'ether') })
      await borrowerOperations.openTrove('1', carol, { from: carol, value: '23082308092385098009809' })

      // Confirm trove statuses became open again
      assert.equal((await troveManager.Troves(alice))[3], '1')
      assert.equal((await troveManager.Troves(bob))[3], '1')
      assert.equal((await troveManager.Troves(carol))[3], '1')

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true when list size is 1 and the trove the only one in system
    it('contains(): true when list size is 1 and the trove the only one in system', async () => {
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      
      assert.isTrue(await sortedTroves.contains(alice))
    })

    // false when list size is 1 and trove is not in the system
    it('contains(): false when list size is 1 and trove is not in the system', async () => {
      await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      
      assert.isFalse(await sortedTroves.contains(bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize()
      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => { 
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(5000, 'ether') }) //  Highest ICR (infinite)
      await borrowerOperations.openTrove(dec(90, 18), A, { from: A, value: dec(10, 'ether') }) //  |  
      await borrowerOperations.openTrove(dec(190, 18), B, { from: B, value: dec(10, 'ether') }) //  | ICR = 500%
      await borrowerOperations.openTrove(dec(390, 18), C, { from: C, value: dec(10, 'ether') }) //  | ICR = 250%
      await borrowerOperations.openTrove(dec(590, 18), D, { from: D, value: dec(10, 'ether') }) //  | 
      await borrowerOperations.openTrove(dec(790, 18), E, { from: E, value: dec(10, 'ether') }) //  Lowest ICR

      console.log(`B ICR: ${await troveManager.getCurrentICR(B, price)}`)
      console.log(`C ICR: ${await troveManager.getCurrentICR(C, price)}`)

      // Expect a trove with ICR 300% to be inserted between B and C
      const targetICR = dec(3, 18) 

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedTroves.findInsertPosition(targetICR, price, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B )
      assert.equal(hints[1], C )
    })

    //--- Ordering --- 
    it("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

      // make several troves with 0 debt and collateral, in random order
      await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.openTrove(0, A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(0, B, { from: B, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(0, C, { from: C, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(0, D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(0, E, { from: E, value: dec(19, 'ether') })

      // Make some troves with non-zero debt, in random order
      await borrowerOperations.openTrove(dec(5, 19), F, { from: F, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(dec(3, 18), G, { from: G, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(dec(2, 20), H, { from: H, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(dec(17, 18), I, { from: I, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(dec(5, 21), J, { from: J, value: dec(1345, 'ether') })

      const price_1 = await priceFeed.getPrice()
      
      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openTrove(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      assert.isTrue(await sortedTroves.contains(defaulter_1))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price_2 = await priceFeed.getPrice()

      // Liquidate a trove
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedTroves with mock dependencies', () => {
    let sortedTrovesTester

    beforeEach(async () => {
      sortedTroves = await SortedTroves.new()
      sortedTrovesTester = await SortedTrovesTester.new()

      await sortedTrovesTester.setSortedTroves(sortedTroves.address)
    })

    context('when params are wrongly set', () => {
      it('setParams(): reverts if size is zero', async () => {
        await th.assertRevert(sortedTroves.setParams(0, sortedTrovesTester.address, sortedTrovesTester.address), 'SortedTroves: Size can’t be zero')
      })
    })

    context('when params are properly set', () => {
      beforeEach('set params', async() => {
        await sortedTroves.setParams(2, sortedTrovesTester.address, sortedTrovesTester.address)
      })

      it('insert(): fails if list is full', async () => {
        await sortedTrovesTester.insert(alice, 1, 1, alice, alice)
        await sortedTrovesTester.insert(bob, 1, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.insert(carol, 1, 1, alice, alice), 'SortedTroves: List is full')
      })

      it('insert(): fails if list already contains the node', async () => {
        await sortedTrovesTester.insert(alice, 1, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.insert(alice, 1, 1, alice, alice), 'SortedTroves: List already contains the node')
      })

      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(th.ZERO_ADDRESS, 1, 1, alice, alice), 'SortedTroves: Id cannot be zero')
      })

      it('insert(): fails if ICR is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(alice, 0, 1, alice, alice), 'SortedTroves: ICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedTrovesTester.remove(alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedTrovesTester.reInsert(alice, 1, 1, alice, alice), 'SortedTroves: List does not contain the id')
      })

      it.skip('reInsert(): fails if new ICR is zero', async () => {
        await sortedTrovesTester.insert(alice, 1, 1, alice, alice)
        assert.isTrue(await sortedTroves.contains(alice), 'list should contain element')
        await th.assertRevert(sortedTrovesTester.reInsert(alice, 0, 1, alice, alice), 'SortedTroves: ICR must be positive')
        assert.isTrue(await sortedTroves.contains(alice), 'list should contain element')
      })

      it('findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedTrovesTester.insert(alice, 1, 1, alice, alice)
        const pos = await sortedTroves.findInsertPosition(1, 1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], th.ZERO_ADDRESS, 'nextId result should be zero')
      })

    })
  })
})
