const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('Gas compensation tests', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _11_Ether = web3.utils.toWei('11', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _200e18 = web3.utils.toWei('200', 'ether')

  const _18_zeros = '000000000000000000'

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale] = accounts;

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

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // --- Compensation scaling by TCR ---

  // TCR = 150%: returns 1
  it('_getCompensationScalingFraction(): returns 1 when TCR is 150%', async () => {
    await borrowerOperations.openLoan(mv._400e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: '1500000000000000000' })

    const price = await priceFeed.getPrice()

    const TCR = await cdpManager.getTCR()
    assert.equal(TCR.toString(), mv._CCR.toString())

    const scalingFraction = (await cdpManagerTester.getCompensationScalingFraction(TCR)).toString()
    assert.equal(scalingFraction, mv._1e18)
  })

  // TCR < 150%: returns 1
  it('_getCompensationScalingFraction(): returns 1 when TCR < 150%', async () => {
    await borrowerOperations.openLoan(mv._400e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: '1500000000000000000' })

    await priceFeed.setPrice(mv._150e18)
    const price = await priceFeed.getPrice()

    const TCR = await cdpManager.getTCR()
    assert.isTrue(TCR.lte(mv._CCR))

    const scalingFraction = (await cdpManagerTester.getCompensationScalingFraction(TCR)).toString()
    assert.equal(scalingFraction, mv._1e18)
  })

  // 150 < TCR < 300%: returns the correct scaling fraction
  it('_getCompensationScalingFraction(): returns the correct scaling fraction when 150% < TCR < 300%', async () => {
    await borrowerOperations.openLoan(mv._400e18, alice, { from: alice, value: mv._3_Ether })

    const price = await priceFeed.getPrice()

    // TCR_1 = (200 * 3) / 400 = 150.00%
    const TCR_1 = await cdpManager.getTCR()
    assert.equal(TCR_1.toString(), mv._CCR.toString())

    const scalingFraction_1 = (await cdpManagerTester.getCompensationScalingFraction(TCR_1)).toString()
    assert.equal(scalingFraction_1, mv._1e18)

    //Alice repays 10 CLV, leaving 390 CLV debt remaining
    await borrowerOperations.repayCLV(mv._10e18, alice, { from: alice })

    // TCR_2 = (200 * 3) / 390 = 153.85%
    const TCR_2 = await cdpManager.getTCR()
    assert.isAtMost(th.getDifference(TCR_2.toString(), '1538461538461538500'), 1000)

    // fraction_2 = (300-153.85)/150 = 0.97
    const scalingFraction_2 = (await cdpManagerTester.getCompensationScalingFraction(TCR_2)).toString()
    assert.isAtMost(th.getDifference(scalingFraction_2, '974358974358974300'), 1000)

    // Alice repays another 40 CLV, leaving 350 CLV debt remaining
    await borrowerOperations.repayCLV(mv._40e18, alice, { from: alice })

    // TCR_3 = (200 * 3) / 350 = 171.43%
    const TCR_3 = await cdpManager.getTCR()
    assert.isAtMost(th.getDifference(TCR_3.toString(), '1714285714285714200'), 1000)

    // fraction_3 = (300-171.43)/150 = 0.86
    const scalingFraction_3 = (await cdpManagerTester.getCompensationScalingFraction(TCR_3)).toString()
    assert.isAtMost(th.getDifference(scalingFraction_3, '857142857142857200'), 1000)

    // Alice repays another 50 CLV, leaving 300 CLV debt remaining
    await borrowerOperations.repayCLV(mv._50e18, alice, { from: alice })

    // TCR_4 = (200 * 3) / 300 = 200.00%
    const TCR_4 = await cdpManager.getTCR()
    assert.isAtMost(th.getDifference(TCR_4.toString(), mv._2e18), 1000)

    // fraction_4 = (300-200)/150 = 0.66
    const scalingFraction_4 = (await cdpManagerTester.getCompensationScalingFraction(TCR_4)).toString()
    assert.isAtMost(th.getDifference(scalingFraction_4, '666666666666666666'), 1000)
  })

  // TCR = 300%: returns 0
  it('_getCompensationScalingFraction(): returns 0 when TCR is 300%', async () => {
    await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: '1500000000000000000' })

    const price = await priceFeed.getPrice()

    const TCR = await cdpManager.getTCR()
    console.log(`TCR: ${TCR}`)
    assert.equal(TCR.toString(), mv._3e18)

    const scalingFraction = (await cdpManagerTester.getCompensationScalingFraction(TCR)).toString()
    assert.equal(scalingFraction, '0')
  })

  // TCR > 300%: returns 0
  it('_getCompensationScalingFraction(): returns 0 when TCR > 300%', async () => {
    await borrowerOperations.openLoan(mv._10e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan('1284', bob, { from: bob, value: '1500000000000000000' })

    const price = await priceFeed.getPrice()

    const TCR = await cdpManager.getTCR()
    assert.isTrue(TCR.gte(mv._3e18))

    const scalingFraction = (await cdpManagerTester.getCompensationScalingFraction(TCR)).toString()
    assert.equal(scalingFraction, '0')
  })

  // --- Test flat minimum $10 compensation amount in ETH  ---

  it('_getMinVirtualDebtlInETH(): Returns the correct minimum virtual debt in ETH terms', async () => {
    await priceFeed.setPrice(mv._200e18)
    const price_1 = await priceFeed.getPrice()
    // Price = 200 $/E. Min. collateral = $10/200 = 0.05 ETH
    const minCollateral_1 = (await cdpManagerTester.getMinVirtualDebtInETH(price_1)).toString()
    assert.isAtMost(th.getDifference(minCollateral_1, '50000000000000000'), 1000)

    await priceFeed.setPrice(mv._1e18)
    const price_2 = await priceFeed.getPrice()
    // Price = 1 $/E. Min. collateral = $10/ = 10 ETH
    const minCollateral_2 = (await cdpManagerTester.getMinVirtualDebtInETH(price_2)).toString()
    assert.isAtMost(th.getDifference(minCollateral_2, mv._10_Ether), 1000)

    await priceFeed.setPrice('44305510968305968340938')
    const price_3 = await priceFeed.getPrice()
    // Price = 44305.11 $/E. Min. collateral = $10/44305.11 = 0.000225705556294193 ETH
    const minCollateral_3 = (await cdpManagerTester.getMinVirtualDebtInETH(price_3)).toString()
    assert.isAtMost(th.getDifference(minCollateral_3, '225705556294193'), 1000)

    await priceFeed.setPrice('999999000000000000000000')
    const price_4 = await priceFeed.getPrice()
    // Price = 999999 $/E. Min. collateral = $10/999999 = 0.000010000010000010 ETH
    const minCollateral_4 = (await cdpManagerTester.getMinVirtualDebtInETH(price_4)).toString()
    assert.isAtMost(th.getDifference(minCollateral_4, '10000010000010'), 1000)
  })

  // --- Raw gas compensation calculations ---

  // returns the entire collateral when entire collateral is < $10 in value

  it('_getGasCompensation(): returns the entire collateral if it is < $10 in value', async () => {
    /* 
    ETH:USD price = 1
    coll = 1 ETH: $1 in value
    -> Expect entire collateral as gas compensation */
    await priceFeed.setPrice(mv._1e18)
    const price_1 = await priceFeed.getPrice()
    const gasCompensation_1 = await cdpManagerTester.getGasCompensation(mv._1_Ether, price_1)
    console.log(`gasCompensation_1: ${gasCompensation_1}`)
    assert.equal(gasCompensation_1, mv._1_Ether)

    /* 
    ETH:USD price = 28.4
    coll = 0.1 ETH: $2.84 in value
    -> Expect entire collateral as gas compensation */
    await priceFeed.setPrice('28400000000000000000')
    const price_2 = await priceFeed.getPrice()
    const gasCompensation_2 = await cdpManagerTester.getGasCompensation(mv._1e17, price_2)
    console.log(`gasCompensation_2: ${gasCompensation_2}`)
    assert.equal(gasCompensation_2, mv._1e17)

    /* 
    ETH:USD price = 1000000000 (1 billion)
    coll = 0.000000005 ETH (5e9 wei): $5 in value 
    -> Expect entire collateral as gas compensation */
    await priceFeed.setPrice(mv._1e27)
    const price_3 = await priceFeed.getPrice()
    const gasCompensation_3 = await cdpManagerTester.getGasCompensation('5000000000', price_3)
    console.log(`gasCompensation_3: ${gasCompensation_3}`)
    assert.equal(gasCompensation_3, '5000000000')
  })

  // returns $10 worth of ETH when 0.5% of coll is worth < $10
  it('_getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH  
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect $10 gas compensation i.e. 0.05 ETH */
    const gasCompensation_1 = await cdpManagerTester.getGasCompensation('9999000000000000000', price)
    console.log(`gasCompensation_1: ${gasCompensation_1}`)
    assert.equal(gasCompensation_1, '50000000000000000')

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect $10 gas compensation i.e. 0.005 ETH */
    const gasCompensation_2 = await cdpManagerTester.getGasCompensation('55000000000000000', price)
    console.log(`gasCompensation_2: ${gasCompensation_2}`)
    assert.equal(gasCompensation_2, '50000000000000000')

    /* ETH:USD price = 200
    coll = 6.09232408808723580 ETH  
    0.5% of coll = 0.004995 ETH. USD value: $6.09
    -> Expect $10 gas compensation i.e. 0.005 ETH */
    const gasCompensation_3 = await cdpManagerTester.getGasCompensation('6092324088087235800', price)
    assert.equal(gasCompensation_3, '50000000000000000')
  })

  // returns $10 worth of ETH when 0.5% of coll == $10
  it('getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect $10 gas compensation, i.e. 0.05 ETH */
    const gasCompensation = await cdpManagerTester.getGasCompensation(mv._10_Ether, price)
    assert.equal(gasCompensation, '50000000000000000')
  })

  // returns 0.5% of coll when 0.5% of coll > $10
  it('getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    0.5% of coll = 0.5 ETH. USD value: $100
    -> Expect $100 gas compensation, i.e. 0.5 ETH */
    const gasCompensation_1 = await cdpManagerTester.getGasCompensation(mv._100_Ether, price)
    console.log(`gasCompensation_1: ${gasCompensation_1}`)
    assert.equal(gasCompensation_1, mv._5e17)

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    0.5% of coll = 0.050005 ETH. USD value: $10.001
    -> Expect $100 gas compensation, i.e.  0.050005  ETH */
    const gasCompensation_2 = await cdpManagerTester.getGasCompensation('10001000000000000000', price)
    console.log(`gasCompensation_2: ${gasCompensation_2}`)
    assert.equal(gasCompensation_2, '50005000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    0.5% of coll = 0.1875 ETH. USD value: $37.5
    -> Expect $37.5 gas compensation i.e.  0.1875  ETH */
    const gasCompensation_3 = await cdpManagerTester.getGasCompensation('37500000000000000000', price)
    assert.equal(gasCompensation_3, '187500000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
    -> Expect $21473894.8385808 gas compensation, i.e.  473.7911529115490  ETH */
    await priceFeed.setPrice('45323545420000000000000')
    const gasCompensation_4 = await cdpManagerTester.getGasCompensation('94758230582309850000000', price)
    console.log(`gasCompensation_4: ${gasCompensation_4}`)
    assert.isAtMost(th.getDifference(gasCompensation_4, '473791152911549000000'), 1000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    0.5% of coll = 1500000 ETH. USD value: $150000000000
    -> Expect $150000000000 gas compensation, i.e. 1500000 ETH */
    await priceFeed.setPrice(mv._1e24)
    const price_2 = await priceFeed.getPrice()
    const gasCompensation_5 = await cdpManagerTester.getGasCompensation('300000000000000000000000000', price_2)
    assert.equal(gasCompensation_5, '1500000000000000000000000')
  })

  // --- Composite debt calculations ---

  // gets debt + 10 when 0.5% of coll < $10

  it('_getCompositeDebt(): returns (debt + 10) when collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH 
    debt = 10 CLV
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect composite debt = 10 + 10  = 20 CLV*/
    const compositeDebt_1 = await cdpManagerTester.getCompositeDebt('9999000000000000000', mv._10e18, price)
    console.log(`compositeDebt_1: ${compositeDebt_1}`)
    assert.equal(compositeDebt_1, mv._20e18)

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     debt = 0 CLV
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect composite debt = 0 + 10 = 10 CLV*/
    const compositeDebt_2 = await cdpManagerTester.getCompositeDebt('55000000000000000', 0, price)
    assert.equal(compositeDebt_2, mv._10e18)

    // /* ETH:USD price = 200
    // coll = 6.09232408808723580 ETH 
    // debt = 200 CLV 
    // 0.5% of coll = 0.004995 ETH. USD value: $6.09
    // -> Expect  composite debt =  200 + 10 = 210  CLV */
    const compositeDebt_3 = await cdpManagerTester.getCompositeDebt('6092324088087235800', mv._200e18, price)
    assert.equal(compositeDebt_3, '210000000000000000000')

  })

  // returns $10 worth of ETH when 0.5% of coll == $10
  it('getCompositeDebt(): returns (debt + 10) when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    debt = 123.45 CLV
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect composite debt = (123.45 + 10) = 133.45 CLV  */
    const compositeDebt = await cdpManagerTester.getCompositeDebt(mv._10_Ether, '123450000000000000000', price)
    assert.equal(compositeDebt, '133450000000000000000')
  })

  /// *** 

  // gets debt + 0.5% of coll when 0.5% of coll > 10
  it('getCompositeDebt(): returns (debt + 0.5% of collateral, in $ ) when 0.5% of collateral > $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, mv._200e18)

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    debt = 2000 CLV
    0.5% of coll = 0.5 ETH. USD value: $100
    -> Expect composite debt = (2000 + 100) = 2100 CLV  */
    const compositeDebt_1 = (await cdpManagerTester.getCompositeDebt(mv._100_Ether, mv._2000e18, price)).toString()
    console.log(`compositeDebt_1: ${compositeDebt_1}`)
    assert.equal(compositeDebt_1, '2100000000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    debt = 200 CLV
    0.5% of coll = 0.050005 ETH. USD value: $10.001
    -> Expect composite debt = (200 + 10.001) = 210.001 CLV  */
    const compositeDebt_2 = (await cdpManagerTester.getCompositeDebt('10001000000000000000', mv._200e18, price)).toString()
    console.log(`compositeDebt_2: ${compositeDebt_2}`)
    assert.equal(compositeDebt_2, '210001000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    debt = 500 CLV
    0.5% of coll = 0.1875 ETH. USD value: $37.5
    -> Expect composite debt = (500 + 37.5) = 537.5 CLV  */
    const compositeDebt_3 = (await cdpManagerTester.getCompositeDebt('37500000000000000000', mv._500e18, price)).toString()
    assert.equal(compositeDebt_3, '537500000000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    debt = 1 billion CLV
    0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
    -> Expect composite debt = (1000000000 + 21473894.8385808) = 121473894.8385808 CLV  */
    await priceFeed.setPrice('45323545420000000000000')
    const price_2 = await priceFeed.getPrice()
    const compositeDebt_4 = (await cdpManagerTester.getCompositeDebt('94758230582309850000000', mv._1e27, price_2)).toString()
    console.log(` compositeDebt_4: ${compositeDebt_4}`)
    assert.isAtMost(th.getDifference(compositeDebt_4, '1021473894838580800000000000'), 100000000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    debt = 1 billion CLV
    0.5% of coll = 1500000 ETH. USD value: $1.5 trillion
   -> Expect composite debt = (1billion + 1.5 trillion) = 1501 billion CLV  */
    await priceFeed.setPrice(mv._1e24)
    const price_3 = await priceFeed.getPrice()
    const compositeDebt_5 = (await cdpManagerTester.getCompositeDebt('300000000000000000000000000', mv._1e27, price_3)).toString()
    console.log(` compositeDebt_5: ${compositeDebt_5}`)
    assert.equal(compositeDebt_5, '1501000000000000000000000000000')
  })

  // --- Test ICRs ---

  // TODO:  Update to $10 collateral 
  it('getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new loans', async () => {
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

    // A opens with 1 ETH, 100 CLV
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    // Expect aliceICR = (1 * 200) / (100+6) = 188.68%
    assert.isAtMost(th.getDifference(alice_ICR, '1886792452830188700'), 1000)

    // B opens with 1.06 ETH, 100 CLV
    await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: '1060000000000000000' })
    const bob_ICR = (await cdpManager.getCurrentICR(bob, price)).toString()
    console.log(`bob_ICR: ${bob_ICR}`)
    // Expect Bob's ICR = (0.53 * 200) / (100+6) = 200%
    assert.isAtMost(th.getDifference(bob_ICR, mv._2e18), 1000)

    // F opens with 1 ETH, 94 CLV
    await borrowerOperations.openLoan('94000000000000000000', flyn, { from: flyn, value: mv._1_Ether })
    const flyn_ICR = (await cdpManager.getCurrentICR(flyn, price)).toString()
    // Expect Flyn's ICR = (1 * 200) / (94+6) = 200%
    assert.isAtMost(th.getDifference(flyn_ICR, mv._2e18), 1000)

    // C opens with 2.5 ETH, 150 CLV
    await borrowerOperations.openLoan(mv._150e18, carol, { from: carol, value: '2500000000000000000' })
    const carol_ICR = (await cdpManager.getCurrentICR(carol, price)).toString()
    // Expect Carol's ICR = (2.5 * 200) / (150+6) = 320.51%
    assert.isAtMost(th.getDifference(carol_ICR, '3205128205128205300'), 1000)

    // D opens with 1 ETH, 0 CLV
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: mv._1_Ether })
    const dennis_ICR = (await cdpManager.getCurrentICR(dennis, price)).toString()
    // Expect Dennis's ICR = (1 * 200) / (6) = 3333.33%
    assert.isAtMost(th.getDifference(dennis_ICR, '33333333333333333333'), 1000)

    // E opens with 4405.45 ETH, 32588.35 CLV
    await borrowerOperations.openLoan('32588345656356049998943', erin, { from: erin, value: '4405453458787537940402' })
    const erin_ICR = (await cdpManager.getCurrentICR(erin, price)).toString()
    // Expect Erin's ICR = (4405.45 * 200) / (32588.34 + 6) = 2703.2010430486757%
    assert.isAtMost(th.getDifference(erin_ICR, '27032010430486757000'), 10000)

    // H opens with 1 ETH, 174 CLV
    await borrowerOperations.openLoan('174000000000000000000', harriet, { from: harriet, value: mv._1_Ether })
    const harriet_ICR = (await cdpManager.getCurrentICR(harriet, price)).toString()
    // Expect Harriet's ICR = (1 * 200) / (174 + 6) = 111.11%
    assert.isAtMost(th.getDifference(harriet_ICR, '1111111111111111111'), 1000)
  })
})

