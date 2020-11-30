const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")


const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues
const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas compensation tests', async accounts => {
  const [
    owner, liquidator,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale] = accounts;

  let priceFeed
  let lusdToken
  let sortedCDPs
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts
  let troveManagerTester
  let borrowerOperationsTester

  const logICRs = (ICRList) => {
    for (let i = 0; i < ICRList.length; i++) {
      console.log(`account: ${i + 1} ICR: ${ICRList[i].toString()}`)
    }
  }

  before(async () => {
    troveManagerTester = await TroveManagerTester.new()
    borrowerOperationsTester = await BorrowerOperationsTester.new()

    TroveManagerTester.setAsDeployed(troveManagerTester)
    BorrowerOperationsTester.setAsDeployed(borrowerOperationsTester)
  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeed
    lusdToken = contracts.lusdToken
    sortedCDPs = contracts.sortedCDPs
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts) 
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  // --- Raw gas compensation calculations ---

  it('_getCollGasCompensation(): returns the 0.5% of collaterall if it is < $10 in value', async () => {
    /* 
    ETH:USD price = 1
    coll = 1 ETH: $1 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 18))
    // const price_1 = await priceFeed.getPrice()
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation(dec(1, 'ether'))).toString()
    assert.equal(gasCompensation_1, dec(5, 15))

    /* 
    ETH:USD price = 28.4
    coll = 0.1 ETH: $2.84 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice('28400000000000000000')
    // const price_2 = await priceFeed.getPrice()
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation(dec(100, 'finney'))).toString()
    assert.equal(gasCompensation_2, dec(5, 14))

    /* 
    ETH:USD price = 1000000000 (1 billion)
    coll = 0.000000005 ETH (5e9 wei): $5 in value 
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 27))
    // const price_3 = await priceFeed.getPrice()
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation('5000000000')).toString()
    assert.equal(gasCompensation_3, '25000000')
  })

  it('_getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH  
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation('9999000000000000000')).toString()
    assert.equal(gasCompensation_1, '49995000000000000')

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation('55000000000000000')).toString()
    assert.equal(gasCompensation_2, dec(275, 12))

    /* ETH:USD price = 200
    coll = 6.09232408808723580 ETH  
    0.5% of coll = 0.004995 ETH. USD value: $6.09
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation('6092324088087235800')).toString()
    assert.equal(gasCompensation_3, '30461620440436179')
  })

  it('getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation = (await troveManagerTester.getCollGasCompensation(dec(10, 'ether'))).toString()
    assert.equal(gasCompensation, '50000000000000000')
  })

  it('getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    0.5% of coll = 0.5 ETH. USD value: $100
    -> Expect $100 gas compensation, i.e. 0.5 ETH */
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation(dec(100, 'ether'))).toString()
    assert.equal(gasCompensation_1, dec(500, 'finney'))

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    0.5% of coll = 0.050005 ETH. USD value: $10.001
    -> Expect $100 gas compensation, i.e.  0.050005  ETH */
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation('10001000000000000000')).toString()
    assert.equal(gasCompensation_2, '50005000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    0.5% of coll = 0.1875 ETH. USD value: $37.5
    -> Expect $37.5 gas compensation i.e.  0.1875  ETH */
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation('37500000000000000000')).toString()
    assert.equal(gasCompensation_3, '187500000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
    -> Expect $21473894.8385808 gas compensation, i.e.  473.7911529115490  ETH */
    await priceFeed.setPrice('45323545420000000000000')
    const gasCompensation_4 = await troveManagerTester.getCollGasCompensation('94758230582309850000000')
    assert.isAtMost(th.getDifference(gasCompensation_4, '473791152911549000000'), 1000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    0.5% of coll = 1500000 ETH. USD value: $150000000000
    -> Expect $150000000000 gas compensation, i.e. 1500000 ETH */
    await priceFeed.setPrice(dec(1, 24))
    const price_2 = await priceFeed.getPrice()
    const gasCompensation_5 = (await troveManagerTester.getCollGasCompensation('300000000000000000000000000')).toString()
    assert.equal(gasCompensation_5, '1500000000000000000000000')
  })

  // --- Composite debt calculations ---

  // gets debt + 10 when 0.5% of coll < $10

  it('_getCompositeDebt(): returns (debt + 10) when collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH 
    debt = 10 LUSD
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect composite debt = 10 + 10  = 20 LUSD*/
    const compositeDebt_1 = await troveManagerTester.getCompositeDebt(dec(10, 18))
    assert.equal(compositeDebt_1, dec(20, 18))

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     debt = 0 LUSD
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect composite debt = 0 + 10 = 10 LUSD*/
    const compositeDebt_2 = await troveManagerTester.getCompositeDebt(0)
    assert.equal(compositeDebt_2, dec(10, 18))

    // /* ETH:USD price = 200
    // coll = 6.09232408808723580 ETH 
    // debt = 200 LUSD 
    // 0.5% of coll = 0.004995 ETH. USD value: $6.09
    // -> Expect  composite debt =  200 + 10 = 210  LUSD */
    const compositeDebt_3 = await troveManagerTester.getCompositeDebt(dec(200, 18))
    assert.equal(compositeDebt_3, '210000000000000000000')
  })

  // returns $10 worth of ETH when 0.5% of coll == $10
  it('getCompositeDebt(): returns (debt + 10) collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    debt = 123.45 LUSD
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect composite debt = (123.45 + 10) = 133.45 LUSD  */
    const compositeDebt = await troveManagerTester.getCompositeDebt('123450000000000000000')
    assert.equal(compositeDebt, '133450000000000000000')
  })

  /// *** 

  // gets debt + 0.5% of coll when 0.5% of coll > 10
  it('getCompositeDebt(): returns (debt + 10 ) when 0.5% of collateral > $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    debt = 2000 LUSD
    -> Expect composite debt = (2000 + 100) = 2010 LUSD  */
    const compositeDebt_1 = (await troveManagerTester.getCompositeDebt(dec(2000, 18))).toString()
    assert.equal(compositeDebt_1, '2010000000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    debt = 200 LUSD
    -> Expect composite debt = (200 + 10.001) = 210 LUSD  */
    const compositeDebt_2 = (await troveManagerTester.getCompositeDebt(dec(200, 18))).toString()
    assert.equal(compositeDebt_2, '210000000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    debt = 500 LUSD
    -> Expect composite debt = (500 + 10) = 510 LUSD  */
    const compositeDebt_3 = (await troveManagerTester.getCompositeDebt(dec(500, 18))).toString()
    assert.equal(compositeDebt_3, '510000000000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    debt = 1 billion LUSD
    -> Expect composite debt = (1000000000 + 10) = 1000000010 LUSD  */
    await priceFeed.setPrice('45323545420000000000000')
    const price_2 = await priceFeed.getPrice()
    const compositeDebt_4 = (await troveManagerTester.getCompositeDebt(dec(1, 27))).toString()
    assert.isAtMost(th.getDifference(compositeDebt_4, '1000000010000000000000000000'), 100000000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    debt = 54321.123456789 LUSD
   -> Expect composite debt = (54321.123456789 + 10) = 54331.123456789 LUSD */
    await priceFeed.setPrice(dec(1, 24))
    const price_3 = await priceFeed.getPrice()
    const compositeDebt_5 = (await troveManagerTester.getCompositeDebt('54321123456789000000000')).toString()
    assert.equal(compositeDebt_5, '54331123456789000000000')
  })

  // --- Test ICRs with virtual debt ---
  it('getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new troves', async () => {
    const price = await priceFeed.getPrice()
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A opens with 1 ETH, 100 LUSD
    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    // Expect aliceICR = (1 * 200) / (100+10) = 181.81%
    assert.isAtMost(th.getDifference(alice_ICR, '1818181818181818181'), 1000)

    // B opens with 0.5 ETH, 40 LUSD
    await borrowerOperations.openTrove(dec(40, 18), bob, { from: bob, value: '500000000000000000' })
    const bob_ICR = (await troveManager.getCurrentICR(bob, price)).toString()
    // Expect Bob's ICR = (0.55 * 200) / (100+10) = 200%
    assert.isAtMost(th.getDifference(bob_ICR, dec(2, 18)), 1000)

    // F opens with 1 ETH, 90 LUSD
    await borrowerOperations.openTrove(dec(90, 18), flyn, { from: flyn, value: dec(1, 'ether') })
    const flyn_ICR = (await troveManager.getCurrentICR(flyn, price)).toString()
    // Expect Flyn's ICR = (1 * 200) / (90+10) = 200%
    assert.isAtMost(th.getDifference(flyn_ICR, dec(2, 18)), 1000)

    // C opens with 2.5 ETH, 150 LUSD
    await borrowerOperations.openTrove(dec(150, 18), carol, { from: carol, value: '2500000000000000000' })
    const carol_ICR = (await troveManager.getCurrentICR(carol, price)).toString()
    // Expect Carol's ICR = (2.5 * 200) / (150+10) = 312.50%
    assert.isAtMost(th.getDifference(carol_ICR, '3125000000000000000'), 1000)

    // D opens with 1 ETH, 0 LUSD
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(1, 'ether') })
    const dennis_ICR = (await troveManager.getCurrentICR(dennis, price)).toString()
    // Expect Dennis's ICR = (1 * 200) / (10) = 2000.00%
    assert.isAtMost(th.getDifference(dennis_ICR, dec(20, 18)), 1000)

    // E opens with 4405.45 ETH, 32588.35 LUSD
    await borrowerOperations.openTrove('32588350000000000000000', erin, { from: erin, value: '4405450000000000000000' })
    const erin_ICR = (await troveManager.getCurrentICR(erin, price)).toString()
    // Expect Erin's ICR = (4405.45 * 200) / (32598.35) = 2702.87%
    assert.isAtMost(th.getDifference(erin_ICR, '27028668628933700000'), 100000)

    // H opens with 1 ETH, 170 LUSD
    await borrowerOperations.openTrove('170000000000000000000', harriet, { from: harriet, value: dec(1, 'ether') })
    const harriet_ICR = (await troveManager.getCurrentICR(harriet, price)).toString()
    // Expect Harriet's ICR = (1 * 200) / (170 + 10) = 111.11%
    assert.isAtMost(th.getDifference(harriet_ICR, '1111111111111111111'), 1000)
  })

  // Test compensation amounts and liquidation amounts

  it('Gas compensation from pool-offset liquidations: collateral < $10 in value. All collateral paid as compensation', async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1000, 18), dennis, { from: dennis, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(1000, 18), erin, { from: erin, value: dec(100, 'ether') })

    // D, E each provide 1000 LUSD to SP
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()

    // --- Price drops to 9.99 ---
    await priceFeed.setPrice('9990000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 9.99
    Alice coll = 1 ETH. Value = (1 * 9.99) = $9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by 0.5% of A's coll (1 ETH)
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    assert.equal(compensationReceived_A, dec(5, 15))

    // Check SP LUSD has decreased due to the liquidation 
    const LUSDinSP_A = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_A.lte(LUSDinSP_0))

    // Check ETH in SP has received the liquidation
    const ETHinSP_A = await stabilityPool.getETH()
    assert.equal(ETHinSP_A, dec(995, 15)) // 1 ETH - 0.5%

    // --- Price drops to 3 ---
    await priceFeed.setPrice(dec(3, 18))
    const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3
    Bob coll = 2 ETH. Value = (2 * 3) = $6
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
    assert.isTrue(bobCollValueInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by B's 0.5% of coll, 2 ETH
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    assert.equal(compensationReceived_B, dec(10, 15)) // 0.5% of 2 ETH

    // Check SP LUSD has decreased due to the liquidation of B
    const LUSDinSP_B = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_B.lt(LUSDinSP_A))

    // Check ETH in SP has received the liquidation
    const ETHinSP_B = await stabilityPool.getETH()
    assert.equal(ETHinSP_B, dec(2985, 15)) // (1 + 2 ETH) * 0.995


    // --- Price drops to 3 ---
    await priceFeed.setPrice('3141592653589793238')
    const price_3 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3.141592653589793238
    Carol coll = 3 ETH. Value = (3 * 3.141592653589793238) = $6
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const carolColl = (await troveManager.CDPs(carol))[1]
    const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price_3))
    assert.isTrue(carolCollValueInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_C = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(carol, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_C = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by C's 0.5% of coll, 3 ETH
    const compensationReceived_C = (liquidatorBalance_after_C.sub(liquidatorBalance_before_C)).toString()
    assert.equal(compensationReceived_C, dec(15, 15))

    // Check SP LUSD has decreased due to the liquidation of C
    const LUSDinSP_C = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_C.lt(LUSDinSP_B))

    // Check ETH in SP has not changed due to the lquidation of C
    const ETHinSP_C = await stabilityPool.getETH()
    assert.equal(ETHinSP_C, dec(5970, 15)) // (1+2+3 ETH) * 0.995
  })

  it('gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Compensates $10 worth of collateral, liquidates the remainder', async () => {

    await priceFeed.setPrice(dec(400, 18))
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(5000, 18), bob, { from: bob, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getETH()

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice('199999000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator, 
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
    assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const aliceICR = await troveManager.getCurrentICR(alice, price_1)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

    // Check SP LUSD has decreased due to the liquidation of A
    const LUSDinSP_A = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_A.lt(LUSDinSP_0))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl)
    const ETHinSP_A = await stabilityPool.getETH()

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)

    // --- Price drops to 15 ---
    await priceFeed.setPrice(dec(15, 18))
    const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator, 
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_2))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const bobICR = await troveManager.getCurrentICR(bob, price_2)
    assert.isTrue(bobICR.lte(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by $10 worth of coll
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    assert.equal(compensationReceived_B, _0pt5percent_bobColl)

    // Check SP LUSD has decreased due to the liquidation of B
    const LUSDinSP_B = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_B.lt(LUSDinSP_A))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl)
    const ETHinSP_B = await stabilityPool.getETH()

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)
  })

  it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Compensates 0.5% of  collateral, liquidates the remainder', async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18))
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(2000, 18), alice, { from: alice, value: '10001000000000000000' })
    await borrowerOperations.openTrove(dec(8000, 18), bob, { from: bob, value: '37500000000000000000' })
    await borrowerOperations.openTrove(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getETH()

    await priceFeed.setPrice(dec(200, 18))
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 200
    Alice coll = 10.001 ETH. Value: $2000.2
    0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
    Minimum comp = $10 = 0.05 ETH.
    -> Expect  0.050005 ETH sent to liquidator, 
    and (10.001 - 0.050005) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))

    assert.isAtMost(th.getDifference(_0pt5percent_aliceColl, '50005000000000000'), 1000)
    assert.isTrue(aliceCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const aliceICR = await troveManager.getCurrentICR(alice, price_1)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

    // Check SP LUSD has decreased due to the liquidation of A 
    const LUSDinSP_A = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_A.lt(LUSDinSP_0))

    // Check ETH in SP has increased by the remainder of A's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl)
    const ETHinSP_A = await stabilityPool.getETH()

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)


    /* 
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator, 
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_1))

    assert.isAtMost(th.getDifference(_0pt5percent_bobColl, '187500000000000000'), 1000)
    assert.isTrue(bobCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const bobICR = await troveManager.getCurrentICR(bob, price_1)
    assert.isTrue(bobICR.lt(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    assert.equal(compensationReceived_B, _0pt5percent_bobColl)

    // Check SP LUSD has decreased due to the liquidation of B
    const LUSDinSP_B = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_B.lt(LUSDinSP_A))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl)
    const ETHinSP_B = await stabilityPool.getETH()

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)

  })

  // --- Event emission in single liquidation ---

  it('Gas compensation from pool-offset liquidations: collateral < $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1000, 18), dennis, { from: dennis, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(1000, 18), erin, { from: erin, value: dec(100, 'ether') })

    // D, E each provide 1000 LUSD to SP
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()

    // --- Price drops to 9.99 ---
    await priceFeed.setPrice('9990000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 9.99
    Alice coll = 1 ETH. Value = (1 * 9.99) = $9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const aliceDebt = (await troveManager.CDPs(alice))[0]
    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_A = aliceColl.mul(th.toBN(5)).div(th.toBN(1000))
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A)
    const expectedLiquidatedDebt_A =  aliceDebt

    const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
    const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
    const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)

      // --- Price drops to 3 ---
      await priceFeed.setPrice(dec(3, 18))
      const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3
    Bob coll = 2 ETH. Value = (2 * 3) = $6
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const bobDebt = (await troveManager.CDPs(bob))[0]
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
    assert.isTrue(bobCollValueInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_B = bobColl.mul(th.toBN(5)).div(th.toBN(1000))
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B)
    const expectedLiquidatedDebt_B =  bobDebt

    const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
    const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
    const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)
  })


  it('gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {

    await priceFeed.setPrice(dec(400, 18))
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(5000, 18), bob, { from: bob, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getETH()

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice('199999000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator, 
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const aliceDebt = (await troveManager.CDPs(alice))[0]
    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
    assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const aliceICR = await troveManager.getCurrentICR(alice, price_1)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_A = _0pt5percent_aliceColl
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A)
    const expectedLiquidatedDebt_A =  aliceDebt

    const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
    const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
    const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)

      // --- Price drops to 15 ---
      await priceFeed.setPrice(dec(15, 18))
      const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator, 
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const bobDebt = (await troveManager.CDPs(bob))[0]
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_2))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const bobICR = await troveManager.getCurrentICR(bob, price_2)
    assert.isTrue(bobICR.lte(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
   
    const expectedGasComp_B = _0pt5percent_bobColl
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B)
    const expectedLiquidatedDebt_B =  bobDebt

    const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
    const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
    const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)
  })


  it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18))
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves
    await borrowerOperations.openTrove(dec(2000, 18), alice, { from: alice, value: '10001000000000000000' })
    await borrowerOperations.openTrove(dec(8000, 18), bob, { from: bob, value: '37500000000000000000' })
    await borrowerOperations.openTrove(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getETH()

    await priceFeed.setPrice(dec(200, 18))
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 200
    Alice coll = 10.001 ETH. Value: $2000.2
    0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
    Minimum comp = $10 = 0.05 ETH.
    -> Expect  0.050005 ETH sent to liquidator, 
    and (10.001 - 0.050005) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const aliceDebt = (await troveManager.CDPs(alice))[0]
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))

    assert.isAtMost(th.getDifference(_0pt5percent_aliceColl, '50005000000000000'), 1000)
    assert.isTrue(aliceCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const aliceICR = await troveManager.getCurrentICR(alice, price_1)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    
    const expectedGasComp_A = _0pt5percent_aliceColl
    const expectedLiquidatedColl_A = aliceColl.sub(_0pt5percent_aliceColl)
    const expectedLiquidatedDebt_A =  aliceDebt

    const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
    const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
    const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)


    /* 
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator, 
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.CDPs(bob))[1]
    const bobDebt = (await troveManager.CDPs(bob))[0]
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_1))

    assert.isAtMost(th.getDifference(_0pt5percent_bobColl, '187500000000000000'), 1000)
    assert.isTrue(bobCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    assert.isFalse(await troveManager.checkRecoveryMode())

    const bobICR = await troveManager.getCurrentICR(bob, price_1)
    assert.isTrue(bobICR.lt(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    
    const expectedGasComp_B = _0pt5percent_bobColl
    const expectedLiquidatedColl_B = bobColl.sub(_0pt5percent_bobColl)
    const expectedLiquidatedDebt_B =  bobDebt

    const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
    const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
    const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)

  })


  // liquidateCDPs - full offset
  it('liquidateCDPs(): full offset.  Compensates the correct amount, and liquidates the remainder', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves. A: 0.04 ETH, 1+10 LUSD.  B: 1ETH, 180+10 LUSD.  C: 5 ETH, 925+10 LUSD.  D: 73.632 ETH, 13500+10 LUSD.
    await borrowerOperations.openTrove(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
    await borrowerOperations.openTrove('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), flyn, { from: flyn, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: flyn })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).lt(mv._MCR))

    // Check E, F have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn, price)).gt(mv._MCR))


    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const bobColl = (await troveManager.CDPs(bob))[1]
    const carolColl = (await troveManager.CDPs(carol))[1]
    const dennisColl = (await troveManager.CDPs(dennis))[1]

    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
    const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
    const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

    // Check A's collateral is < $10 in value
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of B, C and D are > $10 in value
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
    const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
    const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

    // Check collateral of A, B and C are < $10 in value
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of D is > $10 in value
    assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(price)
    assert.equal(collGasCompensation, dec(1, 18))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Liquidate troves A-D

    const liquidatorBalance_before = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check LUSD in SP has decreased
    const LUSDinSP_1 = await stabilityPool.getTotalLUSDDeposits()
    assert.isTrue(LUSDinSP_1.lt(LUSDinSP_0))

    // Check liquidator's balance has increased by the expected compensation amount
    const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()
    assert.equal(expectedGasComp, compensationReceived)

    // Check ETH in stability pool now equals the expected liquidated collateral
    const ETHinSP = (await stabilityPool.getETH()).toString()
    assert.equal(expectedLiquidatedColl, ETHinSP)
  })

  // liquidateCDPs - full redistribution
  it('liquidateCDPs(): full redistribution. Compensates the correct amount, and liquidates the remainder', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves. A: 0.04 ETH, 1 LUSD.  B: 1ETH, 180 LUSD.  C: 5 ETH, 925 LUSD.  D: 73.632 ETH, 13500 LUSD.
    await borrowerOperations.openTrove(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
    await borrowerOperations.openTrove('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

    const LUSDinDefaultPool_0 = await defaultPool.getLUSDDebt()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).lt(mv._MCR))

    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const bobColl = (await troveManager.CDPs(bob))[1]
    const carolColl = (await troveManager.CDPs(carol))[1]
    const dennisColl = (await troveManager.CDPs(dennis))[1]

    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
    const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
    const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

    // Check A's collateral is < $10 in value
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of B, C and D are > $10 in value
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollValueInUSD.gt(th.toBN((dec(10, 18)))))
    assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
    const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
    const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

    // Check collateral of A, B and C are < $10 in value
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of D is > $10 in value
    assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(price)
    assert.equal(collGasCompensation, dec(1 , 18))

    /* Expect total gas compensation = 
       0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
          .add(_0pt5percent_bobColl)
          .add(_0pt5percent_carolColl)
          .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Liquidate troves A-D
    const liquidatorBalance_before = web3.utils.toBN(await web3.eth.getBalance(liquidator))
    await troveManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after = web3.utils.toBN(await web3.eth.getBalance(liquidator))

    // Check LUSD in DefaultPool has decreased
    const LUSDinDefaultPool_1 = await defaultPool.getLUSDDebt()
    assert.isTrue(LUSDinDefaultPool_1.gt(LUSDinDefaultPool_0))

    // Check liquidator's balance has increased by the expected compensation amount
    const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()

    assert.isAtMost(th.getDifference(expectedGasComp, compensationReceived), 1000)

    // Check ETH in defaultPool now equals the expected liquidated collateral
    const ETHinDefaultPool = (await defaultPool.getETH()).toString()
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, ETHinDefaultPool), 1000)
  })

  //  --- event emission in liquidation sequence ---
  it('liquidateCDPs(): full offset. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves. A: 0.04 ETH, 1+10 LUSD.  B: 1ETH, 180+10 LUSD.  C: 5 ETH, 925+10 LUSD.  D: 73.632 ETH, 13500+10 LUSD.
    await borrowerOperations.openTrove(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
    await borrowerOperations.openTrove('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

    await borrowerOperations.openTrove(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(dec(1, 23), flyn, { from: flyn, value: dec(1000, 'ether') })

    // D, E each provide 10000 LUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: flyn })

    const LUSDinSP_0 = await stabilityPool.getTotalLUSDDeposits()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).lt(mv._MCR))

    // Check E, F have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn, price)).gt(mv._MCR))


    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const bobColl = (await troveManager.CDPs(bob))[1]
    const carolColl = (await troveManager.CDPs(carol))[1]
    const dennisColl = (await troveManager.CDPs(dennis))[1]

    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
    const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
    const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

    // Check A's collateral is < $10 in value
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of B, C and D are > $10 in value
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
    const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
    const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

    // Check collateral of A, B and C are < $10 in value
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of D is > $10 in value
    assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(price)
    assert.equal(collGasCompensation, dec(1, 18))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
       0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
          .add(bobColl.sub(_0pt5percent_bobColl))
          .add(carolColl.sub(_0pt5percent_carolColl))
          .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Expect liquidatedDebt = 1 + 180 + 925 + 13500 + 40 (gas comp)= 14646 LUSD
    const expectedLiquidatedDebt = '14646000000000000000000'

    // Liquidate troves A-D
    const liquidationTxData = await troveManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })

    // Get data from the liquidation event logs
    const loggedLiquidatedDebt = liquidationTxData.logs[4].args[0]
    const loggedLiquidatedColl = liquidationTxData.logs[4].args[1]
    const loggedGasCompensation = liquidationTxData.logs[4].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedLiquidatedDebt), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedLiquidatedColl), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp, loggedGasCompensation), 1000)
  })

  it('liquidateCDPs(): full redistribution. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(1, 24) })

    // A-E open troves. A: 0.04 ETH, 1+10 LUSD.  B: 1ETH, 180+10 LUSD.  C: 5 ETH, 925+10 LUSD.  D: 73.632 ETH, 13500+10 LUSD.
    await borrowerOperations.openTrove(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
    await borrowerOperations.openTrove('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

    const LUSDinDefaultPool_0 = await defaultPool.getLUSDDebt()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).lt(mv._MCR))

    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.CDPs(alice))[1]
    const bobColl = (await troveManager.CDPs(bob))[1]
    const carolColl = (await troveManager.CDPs(carol))[1]
    const dennisColl = (await troveManager.CDPs(dennis))[1]

    const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
    const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
    const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
    const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

    // Check A's collateral is < $10 in value
    assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of B, C and D are > $10 in value
    assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
    assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
    const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
    const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
    const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

    // Check collateral of A, B and C are < $10 in value
    assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
    assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

    // Check collateral of D is > $10 in value
    assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl).toString()

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Expect liquidatedDebt = 1 + 180 + 925 + 13500 + 40 (gas comp)= 14646 LUSD
    const expectedLiquidatedDebt = '14646000000000000000000'

    // Liquidate troves A-D
    const liquidationTxData = await troveManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })

    // Get data from the liquidation event logs
    const loggedLiquidatedDebt = liquidationTxData.logs[4].args[0]
    const loggedLiquidatedColl = liquidationTxData.logs[4].args[1]
    const loggedGasCompensation = liquidationTxData.logs[4].args[2]

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedLiquidatedDebt), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedLiquidatedColl), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp, loggedGasCompensation), 1000)
  })

  // --- Trove ordering by ICR tests ---

  it('Trove ordering: same collateral, decreasing debt. Price successively increases. Troves should maintain ordering by ICR', async () => {
    const _10_accounts = accounts.slice(1, 11)

    let debt = 100
    // create 10 troves, constant coll, descending debt 100 to 90 LUSD
    for (account of _10_accounts) {

      const debtString = debt.toString().concat('000000000000000000')
      await borrowerOperations.openTrove(debtString, account, { from: account, value: dec(1, 'ether') })

      const squeezedTroveAddr = th.squeezeAddr(account)

      debt -= 1
    }

    const initialPrice = await priceFeed.getPrice()
    const firstColl = (await troveManager.CDPs(_10_accounts[0]))[1]

    // Vary price 200-210
    let price = 200
    while (price < 210) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []
      const coll_firstTrove = (await troveManager.CDPs(_10_accounts[0]))[1]
      const gasComp_firstTrove = (await troveManagerTester.getCollGasCompensation(coll_firstTrove)).toString()

      for (account of _10_accounts) {
        // Check gas compensation is the same for all troves
        const coll = (await troveManager.CDPs(account))[1]
        const gasCompensation = (await troveManagerTester.getCollGasCompensation(coll)).toString()

        assert.equal(gasCompensation, gasComp_firstTrove)

        const ICR = await troveManager.getCurrentICR(account, price)
        ICRList.push(ICR)


        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 1
      }
    }
  })

  it('Trove ordering: increasing collateral, constant debt. Price successively increases. Troves should maintain ordering by ICR', async () => {
    const _20_accounts = accounts.slice(1, 21)

    let coll = 5
    // create 20 troves, increasing collateral, constant debt = 100LUSD
    for (account of _20_accounts) {

      const collString = coll.toString().concat('000000000000000000')
      await borrowerOperations.openTrove(dec(100, 18), account, { from: account, value: collString })

      coll += 5
    }

    const initialPrice = await priceFeed.getPrice()

    // Vary price 
    let price = 1
    while (price < 300) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []

      for (account of _20_accounts) {
        const ICR = await troveManager.getCurrentICR(account, price)
        ICRList.push(ICR)

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 10
      }
    }
  })

  it('Trove ordering: Constant raw collateral ratio (excluding virtual debt). Price successively increases. Troves should maintain ordering by ICR', async () => {
    let collVals = [1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000]
    const accountsList = accounts.slice(1, collVals.length + 1)

    accountIdx = 0
    for (coll of collVals) {

      const debt = coll * 110

      const account = accountsList[accountIdx]
      const collString = coll.toString().concat('000000000000000000')
      await borrowerOperations.openTrove(dec(100, 18), account, { from: account, value: collString })

      accountIdx += 1
    }

    const initialPrice = await priceFeed.getPrice()

    // Vary price
    let price = 1
    while (price < 300) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []

      for (account of accountsList) {
        const ICR = await troveManager.getCurrentICR(account, price)
        ICRList.push(ICR)

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(error)
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 10
      }
    }
  })
})

