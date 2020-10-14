const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
  
  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeed.getPrice()

    let trove = await contracts.sortedCDPs.getLast()
    while (trove !== (await contracts.sortedCDPs.getFirst())) {
      
      const prevTrove = await contracts.sortedCDPs.getPrev(trove)
     
      const troveICR = await contracts.cdpManager.getCurrentICR(trove, price)
      const prevTroveICR = await contracts.cdpManager.getCurrentICR(prevTrove, price)
      
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
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts

  beforeEach(async () => {
    contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  it('contains(): returns true for addresses that have opened troves', async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // Confirm trove statuses became active
    assert.equal((await cdpManager.CDPs(alice))[3], '1')
    assert.equal((await cdpManager.CDPs(bob))[3], '1')
    assert.equal((await cdpManager.CDPs(carol))[3], '1')

    // Check sorted list contains troves
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
  })

  it('contains(): returns false for addresses that have not opened troves', async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // Confirm troves have non-existent status
    assert.equal((await cdpManager.CDPs(dennis))[3], '0')
    assert.equal((await cdpManager.CDPs(erin))[3], '0')

    // Check sorted list do not contain troves
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
  })

  it('contains(): returns false for addresses that opened and then closed a trove', async () => {
    await borrowerOperations.openLoan('0', whale, { from: whale, value: dec(100, 'ether') })
    
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // A, B, C close loans
    await borrowerOperations.closeLoan({ from: alice })
    await borrowerOperations.closeLoan({ from:bob })
    await borrowerOperations.closeLoan({ from:carol })

    // Confirm trove statuses became closed
    assert.equal((await cdpManager.CDPs(alice))[3], '2')
    assert.equal((await cdpManager.CDPs(bob))[3], '2')
    assert.equal((await cdpManager.CDPs(carol))[3], '2')

    // Check sorted list does not contain troves
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
  })

  // true for addresses that opened -> closed -> opened a trove
  it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
    await borrowerOperations.openLoan('0', whale, { from: whale, value: dec(100, 'ether') })
    
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // A, B, C close loans
    await borrowerOperations.closeLoan({ from: alice })
    await borrowerOperations.closeLoan({ from:bob })
    await borrowerOperations.closeLoan({ from:carol })

    // Confirm trove statuses became closed
    assert.equal((await cdpManager.CDPs(alice))[3], '2')
    assert.equal((await cdpManager.CDPs(bob))[3], '2')
    assert.equal((await cdpManager.CDPs(carol))[3], '2')

    await borrowerOperations.openLoan('234234', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('9999', bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan('1', carol, { from: carol, value: '23082308092385098009809' })

     // Confirm trove statuses became open again
     assert.equal((await cdpManager.CDPs(alice))[3], '1')
     assert.equal((await cdpManager.CDPs(bob))[3], '1')
     assert.equal((await cdpManager.CDPs(carol))[3], '1')

    // Check sorted list does  contain troves
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
  })

  // false when list size is 0
  it('contains(): returns false when there are no troves in the system', async () => {
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
  })

  // true when list size is 1 and the trove the only one in system
  it('contains(): true when list size is 1 and the trove the only one in system', async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  // false when list size is 1 and trove is not in the system
  it('contains(): false when list size is 1 and trove is not in the system', async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    
    assert.isFalse(await sortedCDPs.contains(bob))
  })

  // Ordering
  it("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

    // make several troves with 0 debt and collateral, in random order
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
    await borrowerOperations.openLoan(0, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, B, { from: B, value: dec(37, 'ether') })
    await borrowerOperations.openLoan(0, C, { from: C, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(4, 'ether') })
    await borrowerOperations.openLoan(0, E, { from: E, value: dec(19, 'ether') })

    // Make some troves with non-zero debt, in random orderd
    await borrowerOperations.openLoan(dec(5, 19), F, { from: F, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(3, 18), G, { from: G, value: dec(37, 'ether') })
    await borrowerOperations.openLoan(dec(2, 20), H, { from: H, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(17, 18), I, { from: I, value: dec(4, 'ether') })
    await borrowerOperations.openLoan(dec(5, 21), J, { from: J, value: dec(1345, 'ether') })

    const price_1 = await priceFeed.getPrice()
    
    // Check troves are ordered
    await assertSortedListIsOrdered(contracts)

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(defaulter_1))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price_2 = await priceFeed.getPrice()

    // Liquidate a trove
    await cdpManager.batchLiquidateTroves([defaulter_1])
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    // Check troves are ordered
    await assertSortedListIsOrdered(contracts)
  })
})