const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('CDPManager', async accounts => {

  const _18_zeros = '000000000000000000'

  const [owner, alice, bob, carol, dennis, erin] = accounts;

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
  let hintHelpers

  let cdpManagerTester

  before(async () => {
    cdpManagerTester = await CDPManagerTester.new()
    CDPManagerTester.setAsDeployed(cdpManagerTester)
  })

  beforeEach(async () => {
    const contracts = await deployLiquity()

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
    hintHelpers = contracts.hintHelpers

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // true for addresses added returns true
  it('contains(): returns true for addresses that have opened troves', async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: mv._5_Ether })
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
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: mv._5_Ether })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // Confirm troves have non-existent status
    assert.equal((await cdpManager.CDPs(dennis))[3], '0')
    assert.equal((await cdpManager.CDPs(erin))[3], '0')

    // Check sorted list do not contain troves
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
  })

  it('contains(): returns false for addresses that opened and then closed a trove', async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: mv._5_Ether })
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
  it('contains(): returns false for addresses that opened, closed and then re-opened a trove', async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: mv._5_Ether })
    await borrowerOperations.openLoan('98908089089', carol, { from: carol, value: '23082308092385098009809' })

    // A, B, C close loans
    await borrowerOperations.closeLoan({ from: alice })
    await borrowerOperations.closeLoan({ from:bob })
    await borrowerOperations.closeLoan({ from:carol })

    // Confirm trove statuses became closed
    assert.equal((await cdpManager.CDPs(alice))[3], '2')
    assert.equal((await cdpManager.CDPs(bob))[3], '2')
    assert.equal((await cdpManager.CDPs(carol))[3], '2')

    await borrowerOperations.openLoan('234234', alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('9999', bob, { from: bob, value: mv._5_Ether })
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
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  // false when list size is 1 and trove is not in the system
  it('contains(): false when list size is 1 and trove is not in the system', async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    
    assert.isFalse(await sortedCDPs.contains(bob))
  })
})