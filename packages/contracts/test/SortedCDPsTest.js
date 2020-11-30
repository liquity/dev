const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")


const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
  
  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeed.getPrice()

    let trove = await contracts.sortedCDPs.getLast()
    while (trove !== (await contracts.sortedCDPs.getFirst())) {
      
      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
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
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeedTestnet
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    growthToken = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    await priceFeed.setPrice(dec(200, 18))
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

  // --- getMaxSize ---

  it("getMaxSize(): Returns the maximum list size", async () => {
    const max = await sortedCDPs.getMaxSize()
    assert.equal(web3.utils.toHex(max), th.maxBytes32)
  })

  // --- findInsertPosition ---

  it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => { 
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(5000, 'ether') }) //  Highest ICR (infinite)
    await borrowerOperations.openLoan(dec(90, 18), A, { from: A, value: dec(10, 'ether') }) //  |  
    await borrowerOperations.openLoan(dec(190, 18), B, { from: B, value: dec(10, 'ether') }) //  | ICR = 500%
    await borrowerOperations.openLoan(dec(390, 18), C, { from: C, value: dec(10, 'ether') }) //  | ICR = 250%
    await borrowerOperations.openLoan(dec(590, 18), D, { from: D, value: dec(10, 'ether') }) //  | 
    await borrowerOperations.openLoan(dec(790, 18), E, { from: E, value: dec(10, 'ether') }) //  Lowest ICR

    console.log(`B ICR: ${await cdpManager.getCurrentICR(B, price)}`)
    console.log(`C ICR: ${await cdpManager.getCurrentICR(C, price)}`)

    // Expect a trove with ICR 300% to be inserted between B and C
    const targetICR = dec(3, 18) 

    // Pass addresses that loosely bound the right postiion
    const hints = await sortedCDPs.findInsertPosition(targetICR, price, A, E)

    // Expect the exact correct insert hints have been returned
    assert.equal(hints[0], B )
    assert.equal(hints[1], C )
  })

  //--- Ordering --- 
  it("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

    // make several troves with 0 debt and collateral, in random order
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
    await borrowerOperations.openLoan(0, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, B, { from: B, value: dec(37, 'ether') })
    await borrowerOperations.openLoan(0, C, { from: C, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(4, 'ether') })
    await borrowerOperations.openLoan(0, E, { from: E, value: dec(19, 'ether') })

    // Make some troves with non-zero debt, in random order
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
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    // Check troves are ordered
    await assertSortedListIsOrdered(contracts)
  })
})
