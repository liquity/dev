const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")


const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues

contract('Gas compensation tests', async accounts => {
  const [
    owner, liquidator,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale] = accounts;

  
    let priceFeed
    let clvToken
    let poolManager
    let sortedCDPs
    let cdpManager
    let activePool
    let stabilityPool
    let defaultPool
    let borrowerOperations
    let hintHelpers
  
    let contracts
    let cdpManagerTester
    let borrowerOperationsTester

  const logICRs = (ICRList) => {
    for (let i = 0; i < ICRList.length; i++) {
      console.log(`account: ${i + 1} ICR: ${ICRList[i].toString()}`)
    }
  }

  before(async () => {
    cdpManagerTester = await CDPManagerTester.new()
    borrowerOperationsTester = await BorrowerOperationsTester.new()

    CDPManagerTester.setAsDeployed(cdpManagerTester)
    BorrowerOperationsTester.setAsDeployed(borrowerOperationsTester)
  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(contracts, gtStaking.address) 
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  // --- Test flat minimum $10 compensation amount in ETH  ---

  it('_getMinVirtualDebtlInETH(): Returns the correct minimum virtual debt in ETH terms', async () => {
    await priceFeed.setPrice(dec(200, 18))
    const price_1 = await priceFeed.getPrice()
    // Price = 200 $/E. Min. collateral = $10/200 = 0.05 ETH
    const minCollateral_1 = (await cdpManagerTester.getMinVirtualDebtInETH(price_1)).toString()
    assert.isAtMost(th.getDifference(minCollateral_1, '50000000000000000'), 1000)

    await priceFeed.setPrice(dec(1, 18))
    const price_2 = await priceFeed.getPrice()
    // Price = 1 $/E. Min. collateral = $10/ = 10 ETH
    const minCollateral_2 = (await cdpManagerTester.getMinVirtualDebtInETH(price_2)).toString()
    assert.isAtMost(th.getDifference(minCollateral_2, dec(10, 'ether')), 1000)

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

  // it('_getGasCompensation(): returns the entire collateral if it is < $10 in value', async () => {
  //   /* 
  //   ETH:USD price = 1
  //   coll = 1 ETH: $1 in value
  //   -> Expect entire collateral as gas compensation */
  //   await priceFeed.setPrice(dec(1, 18))
  //   const price_1 = await priceFeed.getPrice()
  //   const gasCompensation_1 = await cdpManagerTester.getGasCompensation(dec(1, 'ether'), price_1)
  //   console.log(`gasCompensation_1: ${gasCompensation_1}`)
  //   assert.equal(gasCompensation_1, dec(1, 'ether'))

  //   /* 
  //   ETH:USD price = 28.4
  //   coll = 0.1 ETH: $2.84 in value
  //   -> Expect entire collateral as gas compensation */
  //   await priceFeed.setPrice('28400000000000000000')
  //   const price_2 = await priceFeed.getPrice()
  //   const gasCompensation_2 = await cdpManagerTester.getGasCompensation(dec(100, 'finney'), price_2)
  //   console.log(`gasCompensation_2: ${gasCompensation_2}`)
  //   assert.equal(gasCompensation_2, dec(100, 'finney'))

  //   /* 
  //   ETH:USD price = 1000000000 (1 billion)
  //   coll = 0.000000005 ETH (5e9 wei): $5 in value 
  //   -> Expect entire collateral as gas compensation */
  //   await priceFeed.setPrice(dec(1, 27))
  //   const price_3 = await priceFeed.getPrice()
  //   const gasCompensation_3 = await cdpManagerTester.getGasCompensation('5000000000', price_3)
  //   console.log(`gasCompensation_3: ${gasCompensation_3}`)
  //   assert.equal(gasCompensation_3, '5000000000')
  // })

  // // returns $10 worth of ETH when 0.5% of coll is worth < $10
  // it('_getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral < $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200
  //   coll = 9.999 ETH  
  //   0.5% of coll = 0.04995 ETH. USD value: $9.99
  //   -> Expect $10 gas compensation i.e. 0.05 ETH */
  //   const gasCompensation_1 = await cdpManagerTester.getGasCompensation('9999000000000000000', price)
  //   console.log(`gasCompensation_1: ${gasCompensation_1}`)
  //   assert.equal(gasCompensation_1, '50000000000000000')

  //   /* ETH:USD price = 200
  //    coll = 0.055 ETH  
  //    0.5% of coll = 0.000275 ETH. USD value: $0.055
  //    -> Expect $10 gas compensation i.e. 0.005 ETH */
  //   const gasCompensation_2 = await cdpManagerTester.getGasCompensation('55000000000000000', price)
  //   console.log(`gasCompensation_2: ${gasCompensation_2}`)
  //   assert.equal(gasCompensation_2, '50000000000000000')

  //   /* ETH:USD price = 200
  //   coll = 6.09232408808723580 ETH  
  //   0.5% of coll = 0.004995 ETH. USD value: $6.09
  //   -> Expect $10 gas compensation i.e. 0.005 ETH */
  //   const gasCompensation_3 = await cdpManagerTester.getGasCompensation('6092324088087235800', price)
  //   assert.equal(gasCompensation_3, '50000000000000000')
  // })

  // // returns $10 worth of ETH when 0.5% of coll == $10
  // it('getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral = $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200
  //   coll = 10 ETH  
  //   0.5% of coll = 0.5 ETH. USD value: $10
  //   -> Expect $10 gas compensation, i.e. 0.05 ETH */
  //   const gasCompensation = await cdpManagerTester.getGasCompensation(dec(10, 'ether'), price)
  //   assert.equal(gasCompensation, '50000000000000000')
  // })

  // // returns 0.5% of coll when 0.5% of coll > $10
  // it('getGasCompensation(): returns $10 worth of ETH when 0.5% of collateral = $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 100 ETH  
  //   0.5% of coll = 0.5 ETH. USD value: $100
  //   -> Expect $100 gas compensation, i.e. 0.5 ETH */
  //   const gasCompensation_1 = await cdpManagerTester.getGasCompensation(dec(100, 'ether'), price)
  //   assert.equal(gasCompensation_1, dec(500, 'finney'))

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 10.001 ETH  
  //   0.5% of coll = 0.050005 ETH. USD value: $10.001
  //   -> Expect $100 gas compensation, i.e.  0.050005  ETH */
  //   const gasCompensation_2 = await cdpManagerTester.getGasCompensation('10001000000000000000', price)
  //   assert.equal(gasCompensation_2, '50005000000000000')

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 37.5 ETH  
  //   0.5% of coll = 0.1875 ETH. USD value: $37.5
  //   -> Expect $37.5 gas compensation i.e.  0.1875  ETH */
  //   const gasCompensation_3 = await cdpManagerTester.getGasCompensation('37500000000000000000', price)
  //   assert.equal(gasCompensation_3, '187500000000000000')

  //   /* 
  //   ETH:USD price = 45323.54542 $/E
  //   coll = 94758.230582309850 ETH  
  //   0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
  //   -> Expect $21473894.8385808 gas compensation, i.e.  473.7911529115490  ETH */
  //   await priceFeed.setPrice('45323545420000000000000')
  //   const gasCompensation_4 = await cdpManagerTester.getGasCompensation('94758230582309850000000', price)
  //   assert.isAtMost(th.getDifference(gasCompensation_4, '473791152911549000000'), 1000000)

  //   /* 
  //   ETH:USD price = 1000000 $/E (1 million)
  //   coll = 300000000 ETH   (300 million)
  //   0.5% of coll = 1500000 ETH. USD value: $150000000000
  //   -> Expect $150000000000 gas compensation, i.e. 1500000 ETH */
  //   await priceFeed.setPrice(dec(1, 24))
  //   const price_2 = await priceFeed.getPrice()
  //   const gasCompensation_5 = await cdpManagerTester.getGasCompensation('300000000000000000000000000', price_2)
  //   assert.equal(gasCompensation_5, '1500000000000000000000000')
  // })

  // // --- Composite debt calculations ---

  // // gets debt + 10 when 0.5% of coll < $10

  // it('_getCompositeDebt(): returns (debt + 10) when collateral < $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200
  //   coll = 9.999 ETH 
  //   debt = 10 CLV
  //   0.5% of coll = 0.04995 ETH. USD value: $9.99
  //   -> Expect composite debt = 10 + 10  = 20 CLV*/
  //   const compositeDebt_1 = await cdpManagerTester.getCompositeDebt(dec(10, 18))
  //   assert.equal(compositeDebt_1, dec(20, 18))

  //   /* ETH:USD price = 200
  //    coll = 0.055 ETH  
  //    debt = 0 CLV
  //    0.5% of coll = 0.000275 ETH. USD value: $0.055
  //    -> Expect composite debt = 0 + 10 = 10 CLV*/
  //   const compositeDebt_2 = await cdpManagerTester.getCompositeDebt(0)
  //   assert.equal(compositeDebt_2, dec(10, 18))

  //   // /* ETH:USD price = 200
  //   // coll = 6.09232408808723580 ETH 
  //   // debt = 200 CLV 
  //   // 0.5% of coll = 0.004995 ETH. USD value: $6.09
  //   // -> Expect  composite debt =  200 + 10 = 210  CLV */
  //   const compositeDebt_3 = await cdpManagerTester.getCompositeDebt(dec(200, 18))
  //   assert.equal(compositeDebt_3, '210000000000000000000')
  // })

  // // returns $10 worth of ETH when 0.5% of coll == $10
  // it('getCompositeDebt(): returns (debt + 10) collateral = $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200
  //   coll = 10 ETH  
  //   debt = 123.45 CLV
  //   0.5% of coll = 0.5 ETH. USD value: $10
  //   -> Expect composite debt = (123.45 + 10) = 133.45 CLV  */
  //   const compositeDebt = await cdpManagerTester.getCompositeDebt('123450000000000000000')
  //   assert.equal(compositeDebt, '133450000000000000000')
  // })

  // /// *** 

  // // gets debt + 0.5% of coll when 0.5% of coll > 10
  // it('getCompositeDebt(): returns (debt + 10 ) when 0.5% of collateral > $10 in value', async () => {
  //   const price = await priceFeed.getPrice()
  //   assert.equal(price, dec(200, 18))

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 100 ETH  
  //   debt = 2000 CLV
  //   -> Expect composite debt = (2000 + 100) = 2010 CLV  */
  //   const compositeDebt_1 = (await cdpManagerTester.getCompositeDebt(dec(2000, 18))).toString()
  //   assert.equal(compositeDebt_1, '2010000000000000000000')

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 10.001 ETH  
  //   debt = 200 CLV
  //   -> Expect composite debt = (200 + 10.001) = 210 CLV  */
  //   const compositeDebt_2 = (await cdpManagerTester.getCompositeDebt(dec(200, 18))).toString()
  //   assert.equal(compositeDebt_2, '210000000000000000000')

  //   /* 
  //   ETH:USD price = 200 $/E
  //   coll = 37.5 ETH  
  //   debt = 500 CLV
  //   -> Expect composite debt = (500 + 10) = 510 CLV  */
  //   const compositeDebt_3 = (await cdpManagerTester.getCompositeDebt(dec(500, 18))).toString()
  //   assert.equal(compositeDebt_3, '510000000000000000000')

  //   /* 
  //   ETH:USD price = 45323.54542 $/E
  //   coll = 94758.230582309850 ETH  
  //   debt = 1 billion CLV
  //   -> Expect composite debt = (1000000000 + 10) = 1000000010 CLV  */
  //   await priceFeed.setPrice('45323545420000000000000')
  //   const price_2 = await priceFeed.getPrice()
  //   const compositeDebt_4 = (await cdpManagerTester.getCompositeDebt(dec(1, 27))).toString()
  //   assert.isAtMost(th.getDifference(compositeDebt_4, '1000000010000000000000000000'), 100000000000)

  //   /* 
  //   ETH:USD price = 1000000 $/E (1 million)
  //   coll = 300000000 ETH   (300 million)
  //   debt = 54321.123456789 CLV
  //  -> Expect composite debt = (54321.123456789 + 10) = 54331.123456789 CLV */
  //   await priceFeed.setPrice(dec(1, 24))
  //   const price_3 = await priceFeed.getPrice()
  //   const compositeDebt_5 = (await cdpManagerTester.getCompositeDebt('54321123456789000000000')).toString()
  //   assert.equal(compositeDebt_5, '54331123456789000000000')
  // })

  // // --- Test ICRs with virtual debt ---
  // it('getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new loans', async () => {
  //   const price = await priceFeed.getPrice()
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

  //   // A opens with 1 ETH, 100 CLV
  //   await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
  //   const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
  //   // Expect aliceICR = (1 * 200) / (100+10) = 181.81%
  //   assert.isAtMost(th.getDifference(alice_ICR, '1818181818181818181'), 1000)

  //   // B opens with 0.5 ETH, 40 CLV
  //   await borrowerOperations.openLoan(dec(40, 18), bob, { from: bob, value: '500000000000000000' })
  //   const bob_ICR = (await cdpManager.getCurrentICR(bob, price)).toString()
  //   console.log(`bob_ICR: ${bob_ICR}`)
  //   // Expect Bob's ICR = (0.55 * 200) / (100+10) = 200%
  //   assert.isAtMost(th.getDifference(bob_ICR, dec(2, 18)), 1000)

  //   // F opens with 1 ETH, 90 CLV
  //   await borrowerOperations.openLoan(dec(90, 18), flyn, { from: flyn, value: dec(1, 'ether') })
  //   const flyn_ICR = (await cdpManager.getCurrentICR(flyn, price)).toString()
  //   // Expect Flyn's ICR = (1 * 200) / (90+10) = 200%
  //   assert.isAtMost(th.getDifference(flyn_ICR, dec(2, 18)), 1000)

  //   // C opens with 2.5 ETH, 150 CLV
  //   await borrowerOperations.openLoan(dec(150, 18), carol, { from: carol, value: '2500000000000000000' })
  //   const carol_ICR = (await cdpManager.getCurrentICR(carol, price)).toString()
  //   // Expect Carol's ICR = (2.5 * 200) / (150+10) = 312.50%
  //   assert.isAtMost(th.getDifference(carol_ICR, '3125000000000000000'), 1000)

  //   // D opens with 1 ETH, 0 CLV
  //   await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(1, 'ether') })
  //   const dennis_ICR = (await cdpManager.getCurrentICR(dennis, price)).toString()
  //   // Expect Dennis's ICR = (1 * 200) / (10) = 2000.00%
  //   assert.isAtMost(th.getDifference(dennis_ICR, dec(20, 18)), 1000)

  //   // E opens with 4405.45 ETH, 32588.35 CLV
  //   await borrowerOperations.openLoan('32588350000000000000000', erin, { from: erin, value: '4405450000000000000000' })
  //   const erin_ICR = (await cdpManager.getCurrentICR(erin, price)).toString()
  //   // Expect Erin's ICR = (4405.45 * 200) / (32598.35) = 2702.87%
  //   assert.isAtMost(th.getDifference(erin_ICR, '27028668628933700000'), 100000)

  //   // H opens with 1 ETH, 170 CLV
  //   await borrowerOperations.openLoan('170000000000000000000', harriet, { from: harriet, value: dec(1, 'ether') })
  //   const harriet_ICR = (await cdpManager.getCurrentICR(harriet, price)).toString()
  //   // Expect Harriet's ICR = (1 * 200) / (170 + 10) = 111.11%
  //   assert.isAtMost(th.getDifference(harriet_ICR, '1111111111111111111'), 1000)
  // })

  // // Test compensation amounts and liquidation amounts

  // it('Gas compensation from pool-offset liquidations: collateral < $10 in value. All collateral paid as compensation', async () => {
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
  //   await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1000, 18), dennis, { from: dennis, value: dec(100, 'ether') })
  //   await borrowerOperations.openLoan(dec(1000, 18), erin, { from: erin, value: dec(100, 'ether') })

  //   // D, E each provide 1000 CLV to SP
  //   await poolManager.provideToSP(dec(1000, 18), { from: dennis })
  //   await poolManager.provideToSP(dec(1000, 18), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()

  //   // --- Price drops to 9.99 ---
  //   await priceFeed.setPrice('9990000000000000000')
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 9.99
  //   Alice coll = 1 ETH. Value = (1 * 9.99) = $9.99
  //   -> Expect entire collateral to be sent to liquidator, as gas compensation */

  //   // Check collateral value in USD is < $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   // Check liquidator's balance increases by A's entire coll, 1 ETH
  //   const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
  //   assert.equal(compensationReceived_A, dec(1, 'ether'))

  //   // Check SP CLV has decreased due to the liquidation 
  //   const CLVinSP_A = await stabilityPool.getCLV()
  //   assert.isTrue(CLVinSP_A.lte(CLVinSP_0))

  //   // Check ETH in SP has not changed due to the liquidation
  //   const ETHinSP_A = await stabilityPool.getETH()
  //   assert.equal(ETHinSP_A, '0')

  //   // --- Price drops to 3 ---
  //   await priceFeed.setPrice(dec(3, 18))
  //   const price_2 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 3
  //   Bob coll = 2 ETH. Value = (2 * 3) = $6
  //   -> Expect entire collateral to be sent to liquidator, as gas compensation */

  //   // Check collateral value in USD is < $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
  //   assert.isTrue(bobCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())
  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   // Check liquidator's balance increases by B's entire coll, 2 ETH
  //   const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
  //   assert.equal(compensationReceived_B, dec(2, 'ether'))

  //   // Check SP CLV has decreased due to the liquidation of B
  //   const CLVinSP_B = await stabilityPool.getCLV()
  //   assert.isTrue(CLVinSP_B.lt(CLVinSP_A))

  //   // Check ETH in SP has not changed due to the liquidation of B
  //   const ETHinSP_B = await stabilityPool.getETH()
  //   assert.equal(ETHinSP_B, '0')


  //   // --- Price drops to 3 ---
  //   await priceFeed.setPrice('3141592653589793238')
  //   const price_3 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 3.141592653589793238
  //   Carol coll = 3 ETH. Value = (3 * 3.141592653589793238) = $6
  //   -> Expect entire collateral to be sent to liquidator, as gas compensation */

  //   // Check collateral value in USD is < $10
  //   const carolColl = (await cdpManager.CDPs(carol))[1]
  //   const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price_3))
  //   assert.isTrue(carolCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())
  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_C = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(carol, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_C = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   // Check liquidator's balance increases by C's entire coll, 2 ETH
  //   const compensationReceived_C = (liquidatorBalance_after_C.sub(liquidatorBalance_before_C)).toString()
  //   assert.equal(compensationReceived_C, dec(3, 'ether'))

  //   // Check SP CLV has decreased due to the liquidation of C
  //   const CLVinSP_C = await stabilityPool.getCLV()
  //   assert.isTrue(CLVinSP_C.lt(CLVinSP_B))

  //   // Check ETH in SP has not changed due to the lquidation of C
  //   const ETHinSP_C = await stabilityPool.getETH()
  //   assert.equal(ETHinSP_C, '0')
  // })

  // it('gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Compensates $10 worth of collateral, liquidates the remainder', async () => {

  //   await priceFeed.setPrice(dec(400, 18))
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan(dec(5000, 18), bob, { from: bob, value: dec(15, 'ether') })
  //   await borrowerOperations.openLoan(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: dennis })
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()
  //   const ETHinSP_0 = await stabilityPool.getETH()

  //   // --- Price drops to 199.999 ---
  //   await priceFeed.setPrice('199999000000000000000')
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 199.999
  //   Alice coll = 1 ETH. Value: $199.999
  //   0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
  //   Minimum comp = $10 = 0.05000025000125001 ETH.
  //   -> Expect 0.05000025000125001 ETH sent to liquidator, 
  //   and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

  //   // Check collateral value in USD is > $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
  //   assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // Check value of 0.5% of collateral in USD is < $10
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const aliceICR = await cdpManager.getCurrentICR(alice, price_1)
  //   console.log(`aliceICR: ${aliceICR}`)
  //   assert.isTrue(aliceICR.lt(mv._MCR))

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   let _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price_1)
  //   console.log(`10_worthOfETH: ${_$10_worthOfETH}`)
  //   assert.isAtMost(th.getDifference(_$10_worthOfETH, '50000250001250010'), 1000)

  //   // Check liquidator's balance increases by $10 worth of coll
  //   const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
  //   assert.equal(compensationReceived_A, _$10_worthOfETH)

  //   // Check SP CLV has decreased due to the liquidation of A
  //   const CLVinSP_A = await stabilityPool.getCLV()
  //   assert.isTrue(CLVinSP_A.lt(CLVinSP_0))

  //   // Check ETH in SP has increased by the remainder of B's coll
  //   const collRemainder_A = aliceColl.sub(_$10_worthOfETH)
  //   const ETHinSP_A = await stabilityPool.getETH()

  //   const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

  //   console.log(`SPETHIncrease_A: ${SPETHIncrease_A}`)
  //   console.log(`ETHinSP_A: ${ETHinSP_A}`)
  //   console.log(`collRemainder_A: ${collRemainder_A}`)

  //   assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)

  //   // --- Price drops to 15 ---
  //   await priceFeed.setPrice(dec(15, 18))
  //   const price_2 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 15
  //   Bob coll = 15 ETH. Value: $165
  //   0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
  //   Minimum comp = $10 =  0.66666...ETH.
  //   -> Expect 0.666666666666666666 ETH sent to liquidator, 
  //   and (15 - 0.666666666666666666) ETH remainder liquidated */

  //   // Check collateral value in USD is > $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // Check value of 0.5% of collateral in USD is < $10
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_2))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const bobICR = await cdpManager.getCurrentICR(bob, price_2)
  //   console.log(`bobICR: ${bobICR}`)
  //   assert.isTrue(bobICR.lte(mv._MCR))

  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price_2)
  //   console.log(`10_worthOfETH: ${_$10_worthOfETH}`)
  //   assert.isAtMost(th.getDifference(_$10_worthOfETH, '666666666666666666'), 1000)

  //   // Check liquidator's balance increases by $10 worth of coll
  //   const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
  //   assert.equal(compensationReceived_B, _$10_worthOfETH)

  //   // Check SP CLV has decreased due to the liquidation of B
  //   const CLVinSP_B = await stabilityPool.getCLV()
  //   console.log(`CLVinSP_B:${CLVinSP_B}`)
  //   assert.isTrue(CLVinSP_B.lt(CLVinSP_A))

  //   // Check ETH in SP has increased by the remainder of B's coll
  //   const collRemainder_B = bobColl.sub(_$10_worthOfETH)
  //   const ETHinSP_B = await stabilityPool.getETH()

  //   const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

  //   console.log(`SPETHIncrease_B: ${SPETHIncrease_B}`)
  //   console.log(`ETHinSP_B: ${ETHinSP_B}`)
  //   console.log(`collRemainder_B: ${collRemainder_B}`)

  //   assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)
  // })

  // it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Compensates 0.5% of  collateral, liquidates the remainder', async () => {
  //   // open loans
  //   await priceFeed.setPrice(dec(400, 18))
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(2000, 18), alice, { from: alice, value: '10001000000000000000' })
  //   await borrowerOperations.openLoan(dec(8000, 18), bob, { from: bob, value: '37500000000000000000' })
  //   await borrowerOperations.openLoan(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: dennis })
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()
  //   const ETHinSP_0 = await stabilityPool.getETH()

  //   await priceFeed.setPrice(dec(200, 18))
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 200
  //   Alice coll = 10.001 ETH. Value: $2000.2
  //   0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
  //   Minimum comp = $10 = 0.05 ETH.
  //   -> Expect  0.050005 ETH sent to liquidator, 
  //   and (10.001 - 0.050005) ETH remainder liquidated */

  //   // Check value of 0.5% of collateral in USD is > $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))

  //   assert.isAtMost(th.getDifference(_0pt5percent_aliceColl, '50005000000000000'), 1000)
  //   assert.isTrue(aliceCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const aliceICR = await cdpManager.getCurrentICR(alice, price_1)
  //   console.log(`aliceICR: ${aliceICR}`)
  //   assert.isTrue(aliceICR.lt(mv._MCR))

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_A = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   // Check liquidator's balance increases by 0.5% of coll
  //   const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
  //   assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

  //   // Check SP CLV has decreased due to the liquidation of A 
  //   const CLVinSP_A = await stabilityPool.getCLV()
  //   console.log(`CLVinSP_A: ${CLVinSP_A}`)
  //   assert.isTrue(CLVinSP_A.lt(CLVinSP_0))

  //   // Check ETH in SP has increased by the remainder of A's coll
  //   const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl)
  //   const ETHinSP_A = await stabilityPool.getETH()

  //   const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

  //   console.log(`SPETHIncrease_A: ${SPETHIncrease_A}`)
  //   console.log(`ETHinSP_A: ${ETHinSP_A}`)
  //   console.log(`collRemainder_A: ${collRemainder_A}`)

  //   assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)


  //   /* 
  //  ETH:USD price = 200
  //  Bob coll = 37.5 ETH. Value: $7500
  //  0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
  //  Minimum comp = $10 = 0.05 ETH.
  //  -> Expect 0.1875 ETH sent to liquidator, 
  //  and (37.5 - 0.1875 ETH) ETH remainder liquidated */

  //   // Check value of 0.5% of collateral in USD is > $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_1))

  //   assert.isAtMost(th.getDifference(_0pt5percent_bobColl, '187500000000000000'), 1000)
  //   assert.isTrue(bobCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const bobICR = await cdpManager.getCurrentICR(bob, price_1)
  //   console.log(`bobICR: ${bobICR}`)
  //   assert.isTrue(bobICR.lt(mv._MCR))

  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidatorBalance_before_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after_B = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   // Check liquidator's balance increases by 0.5% of coll
  //   const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
  //   assert.equal(compensationReceived_B, _0pt5percent_bobColl)

  //   // Check SP CLV has decreased due to the liquidation of B
  //   const CLVinSP_B = await stabilityPool.getCLV()
  //   console.log(`CLVinSP_B: ${CLVinSP_B}`)
  //   assert.isTrue(CLVinSP_B.lt(CLVinSP_A))

  //   // Check ETH in SP has increased by the remainder of B's coll
  //   const collRemainder_B = bobColl.sub(_0pt5percent_bobColl)
  //   const ETHinSP_B = await stabilityPool.getETH()

  //   const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

  //   console.log(`SPETHIncrease_B: ${SPETHIncrease_B}`)
  //   console.log(`ETHinSP_B: ${ETHinSP_B}`)
  //   console.log(`collRemainder_B: ${collRemainder_B}`)

  //   assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)

  // })

  // // --- Event emission in single liquidation ---

  // it('Gas compensation from pool-offset liquidations: collateral < $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
  //   await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1000, 18), dennis, { from: dennis, value: dec(100, 'ether') })
  //   await borrowerOperations.openLoan(dec(1000, 18), erin, { from: erin, value: dec(100, 'ether') })

  //   // D, E each provide 1000 CLV to SP
  //   await poolManager.provideToSP(dec(1000, 18), { from: dennis })
  //   await poolManager.provideToSP(dec(1000, 18), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()

  //   // --- Price drops to 9.99 ---
  //   await priceFeed.setPrice('9990000000000000000')
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 9.99
  //   Alice coll = 1 ETH. Value = (1 * 9.99) = $9.99
  //   -> Expect entire collateral to be sent to liquidator, as gas compensation */

  //   // Check collateral value in USD is < $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const aliceDebt = (await cdpManager.CDPs(alice))[0]
  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidationTxA = await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })

  //   const expectedGasComp_A = aliceColl
  //   const expectedLiquidatedColl_A = '0'
  //   const expectedLiquidatedDebt_A =  aliceDebt

  //   const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
  //   const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
  //   const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)

  //     // --- Price drops to 3 ---
  //     await priceFeed.setPrice(dec(3, 18))
  //     const price_2 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 3
  //   Bob coll = 2 ETH. Value = (2 * 3) = $6
  //   -> Expect entire collateral to be sent to liquidator, as gas compensation */

  //   // Check collateral value in USD is < $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const bobDebt = (await cdpManager.CDPs(bob))[0]
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
  //   assert.isTrue(bobCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())
  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidationTxB = await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })

  //   const expectedGasComp_B = bobColl
  //   const expectedLiquidatedColl_B = '0'
  //   const expectedLiquidatedDebt_B =  bobDebt

  //   const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
  //   const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
  //   const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)
  // })


  // it('gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {

  //   await priceFeed.setPrice(dec(400, 18))
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan(dec(5000, 18), bob, { from: bob, value: dec(15, 'ether') })
  //   await borrowerOperations.openLoan(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: dennis })
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()
  //   const ETHinSP_0 = await stabilityPool.getETH()

  //   // --- Price drops to 199.999 ---
  //   await priceFeed.setPrice('199999000000000000000')
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 199.999
  //   Alice coll = 1 ETH. Value: $199.999
  //   0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
  //   Minimum comp = $10 = 0.05000025000125001 ETH.
  //   -> Expect 0.05000025000125001 ETH sent to liquidator, 
  //   and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

  //   // Check collateral value in USD is > $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const aliceDebt = (await cdpManager.CDPs(alice))[0]
  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price_1))
  //   assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // Check value of 0.5% of collateral in USD is < $10
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const aliceICR = await cdpManager.getCurrentICR(alice, price_1)
  //   console.log(`aliceICR: ${aliceICR}`)
  //   assert.isTrue(aliceICR.lt(mv._MCR))

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidationTxA = await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })


  //   let _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price_1)
  //   console.log(`10_worthOfETH: ${_$10_worthOfETH}`)
  //   assert.isAtMost(th.getDifference(_$10_worthOfETH, '50000250001250010'), 1000)

  //   const expectedGasComp_A = _$10_worthOfETH
  //   const expectedLiquidatedColl_A = aliceColl.sub(_$10_worthOfETH)
  //   const expectedLiquidatedDebt_A =  aliceDebt

  //   const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
  //   const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
  //   const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)

  //     // --- Price drops to 15 ---
  //     await priceFeed.setPrice(dec(15, 18))
  //     const price_2 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 15
  //   Bob coll = 15 ETH. Value: $165
  //   0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
  //   Minimum comp = $10 =  0.66666...ETH.
  //   -> Expect 0.666666666666666666 ETH sent to liquidator, 
  //   and (15 - 0.666666666666666666) ETH remainder liquidated */

  //   // Check collateral value in USD is > $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const bobDebt = (await cdpManager.CDPs(bob))[0]
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price_2))
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // Check value of 0.5% of collateral in USD is < $10
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_2))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const bobICR = await cdpManager.getCurrentICR(bob, price_2)
  //   console.log(`bobICR: ${bobICR}`)
  //   assert.isTrue(bobICR.lte(mv._MCR))

  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives
  //   const liquidationTxB = await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
   
  //   _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price_2)
  //   console.log(`10_worthOfETH: ${_$10_worthOfETH}`)
  //   assert.isAtMost(th.getDifference(_$10_worthOfETH, '666666666666666666'), 1000)

  //   const expectedGasComp_B = _$10_worthOfETH
  //   const expectedLiquidatedColl_B = bobColl.sub(_$10_worthOfETH)
  //   const expectedLiquidatedDebt_B =  bobDebt

  //   const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
  //   const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
  //   const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)
  // })


  // it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
  //   // open loans
  //   await priceFeed.setPrice(dec(400, 18))
  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans
  //   await borrowerOperations.openLoan(dec(2000, 18), alice, { from: alice, value: '10001000000000000000' })
  //   await borrowerOperations.openLoan(dec(8000, 18), bob, { from: bob, value: '37500000000000000000' })
  //   await borrowerOperations.openLoan(dec(600, 18), carol, { from: carol, value: dec(3, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: dennis })
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })

  //   const CLVinSP_0 = await stabilityPool.getCLV()
  //   const ETHinSP_0 = await stabilityPool.getETH()

  //   await priceFeed.setPrice(dec(200, 18))
  //   const price_1 = await priceFeed.getPrice()

  //   /* 
  //   ETH:USD price = 200
  //   Alice coll = 10.001 ETH. Value: $2000.2
  //   0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
  //   Minimum comp = $10 = 0.05 ETH.
  //   -> Expect  0.050005 ETH sent to liquidator, 
  //   and (10.001 - 0.050005) ETH remainder liquidated */

  //   // Check value of 0.5% of collateral in USD is > $10
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const aliceDebt = (await cdpManager.CDPs(alice))[0]
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price_1))

  //   assert.isAtMost(th.getDifference(_0pt5percent_aliceColl, '50005000000000000'), 1000)
  //   assert.isTrue(aliceCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const aliceICR = await cdpManager.getCurrentICR(alice, price_1)
  //   console.log(`aliceICR: ${aliceICR}`)
  //   assert.isTrue(aliceICR.lt(mv._MCR))

  //   // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidationTxA = await cdpManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    
  //   const expectedGasComp_A = _0pt5percent_aliceColl
  //   const expectedLiquidatedColl_A = aliceColl.sub(_0pt5percent_aliceColl)
  //   const expectedLiquidatedDebt_A =  aliceDebt

  //   const loggedLiquidatedDebt_A = liquidationTxA.logs[1].args[0]
  //   const loggedLiquidatedColl_A = liquidationTxA.logs[1].args[1]
  //   const loggedGasCompensation_A = liquidationTxA.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedLiquidatedDebt_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedLiquidatedColl_A), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasCompensation_A), 1000)


  //   /* 
  //  ETH:USD price = 200
  //  Bob coll = 37.5 ETH. Value: $7500
  //  0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
  //  Minimum comp = $10 = 0.05 ETH.
  //  -> Expect 0.1875 ETH sent to liquidator, 
  //  and (37.5 - 0.1875 ETH) ETH remainder liquidated */

  //   // Check value of 0.5% of collateral in USD is > $10
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const bobDebt = (await cdpManager.CDPs(bob))[0]
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price_1))

  //   assert.isAtMost(th.getDifference(_0pt5percent_bobColl, '187500000000000000'), 1000)
  //   assert.isTrue(bobCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   const bobICR = await cdpManager.getCurrentICR(bob, price_1)
  //   console.log(`bobICR: ${bobICR}`)
  //   assert.isTrue(bobICR.lt(mv._MCR))

  //   // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
  //   const liquidationTxB = await cdpManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    
  //   const expectedGasComp_B = _0pt5percent_bobColl
  //   const expectedLiquidatedColl_B = bobColl.sub(_0pt5percent_bobColl)
  //   const expectedLiquidatedDebt_B =  bobDebt

  //   const loggedLiquidatedDebt_B = liquidationTxB.logs[1].args[0]
  //   const loggedLiquidatedColl_B = liquidationTxB.logs[1].args[1]
  //   const loggedGasCompensation_B = liquidationTxB.logs[1].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedLiquidatedDebt_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedLiquidatedColl_B), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasCompensation_B), 1000)

  // })


  // // liquidateCDPs - full offset
  // it('liquidateCDPs(): full offset.  Compensates the correct amount, and liquidates the remainder', async () => {
  //   await priceFeed.setPrice(dec(1000, 18))

  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans. A: 0.04 ETH, 1 CLV.  B: 1ETH, 180 CLV.  C: 5 ETH, 925 CLV.  D: 73.632 ETH, 13500 CLV.
  //   await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
  //   await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
  //   await borrowerOperations.openLoan('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), flyn, { from: flyn, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })
  //   await poolManager.provideToSP(dec(1, 23), { from: flyn })

  //   const CLVinSP_0 = await stabilityPool.getCLV()

  //   // price drops to 200 
  //   await priceFeed.setPrice(dec(200, 18))
  //   const price = await priceFeed.getPrice()

  //   // Check not in Recovery Mode 
  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Check A, B, C, D have ICR < MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))

  //   // Check E, F have ICR > MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).gt(mv._MCR))


  //   // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const carolColl = (await cdpManager.CDPs(carol))[1]
  //   const dennisColl = (await cdpManager.CDPs(dennis))[1]

  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
  //   const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
  //   const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

  //   // Check A's collateral is < $10 in value
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of B, C and D are > $10 in value
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
  //   const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
  //   const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

  //   // Check collateral of A, B and C are < $10 in value
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of D is > $10 in value
  //   assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   const _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price)
  //   assert.equal(_$10_worthOfETH, '50000000000000000')

  //   /* Expect total gas compensation = 
  //   [A_coll + (2 * $10 worth of ETH ) + 0.5% of D_coll]
  //   = 0.04 + (2*0.05) + 0.36816
  //   = 0.50816 ETH
  //   */
  //   const expectedGasComp = aliceColl
  //     .add(_$10_worthOfETH)
  //     .add(_$10_worthOfETH)
  //     .add(_0pt5percent_dennisColl)

  //   console.log(`expectedGasComp: ${expectedGasComp}`)
  //   assert.isAtMost(th.getDifference(expectedGasComp, '508160000000000000'), 1000)

  //   /* Expect liquidated coll = 
  //   [ (B_coll - 0.05) + (C_coll - 0.05) + (D_coll - D_coll/200)]
  //   = 0.95 + 4.95 + 73.26384
  //   = 79.16384 ETH
  //   */
  //   const expectedLiquidatedColl = bobColl.sub(_$10_worthOfETH)
  //     .add(carolColl.sub(_$10_worthOfETH))
  //     .add(dennisColl.sub(_0pt5percent_dennisColl))

  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, '79163840000000000000'), 1000)

  //   // Liquidate troves A-D

  //   const liquidatorBalance_before = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   console.log(`liquidatorBalance_before: ${liquidatorBalance_before}`)
  //   console.log(`liquidatorBalance_after: ${liquidatorBalance_after}`)

  //   // Check CLV in SP has decreased
  //   const CLVinSP_1 = await stabilityPool.getCLV()
  //   assert.isTrue(CLVinSP_1.lt(CLVinSP_0))

  //   // Check liquidator's balance has increased by the expected compensation amount
  //   const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()
  //   console.log(`expectedGasComp: ${expectedGasComp}`)
  //   console.log(`compensationReceived: ${compensationReceived}`)
  //   assert.equal(expectedGasComp, compensationReceived)

  //   // Check ETH in stability pool now equals the expected liquidated collateral
  //   const ETHinSP = (await stabilityPool.getETH()).toString()
  //   assert.equal(expectedLiquidatedColl, ETHinSP)
  // })

  // // liquidateCDPs - full redistribution
  // it('liquidateCDPs(): full redistribution. Compensates the correct amount, and liquidates the remainder', async () => {
  //   await priceFeed.setPrice(dec(1000, 18))

  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans. A: 0.04 ETH, 1 CLV.  B: 1ETH, 180 CLV.  C: 5 ETH, 925 CLV.  D: 73.632 ETH, 13500 CLV.
  //   await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
  //   await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
  //   await borrowerOperations.openLoan('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

  //   const CLVinDefaultPool_0 = await defaultPool.getCLVDebt()

  //   // price drops to 200 
  //   await priceFeed.setPrice(dec(200, 18))
  //   const price = await priceFeed.getPrice()

  //   // Check not in Recovery Mode 
  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Check A, B, C, D have ICR < MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))

  //   // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const carolColl = (await cdpManager.CDPs(carol))[1]
  //   const dennisColl = (await cdpManager.CDPs(dennis))[1]

  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
  //   const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
  //   const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

  //   // Check A's collateral is < $10 in value
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of B, C and D are > $10 in value
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollValueInUSD.gtth.toBN((dec(10, 18))))
  //   assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
  //   const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
  //   const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

  //   // Check collateral of A, B and C are < $10 in value
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of D is > $10 in value
  //   assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   const _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price)
  //   assert.equal(_$10_worthOfETH, '50000000000000000')

  //   /* Expect total gas compensation = 
  //   [A_coll + (2 * $10 worth of ETH ) + 0.5% of D_coll]
  //   = 0.04 + (2*0.05) + 0.36816
  //   = 0.50816 ETH
  //   */
  //   const expectedGasComp = aliceColl
  //     .add(_$10_worthOfETH)
  //     .add(_$10_worthOfETH)
  //     .add(_0pt5percent_dennisColl).toString()

  //   console.log(`expectedGasComp: ${expectedGasComp}`)
  //   assert.isAtMost(th.getDifference(expectedGasComp, '508160000000000000'), 1000)

  //   /* Expect liquidated coll = 
  //   [ (B_coll - 0.05) + (C_coll - 0.05) + (D_coll - D_coll/200)]
  //   = 0.95 + 4.95 + 73.26384
  //   = 79.16384 ETH
  //   */
  //   const expectedLiquidatedColl = bobColl.sub(_$10_worthOfETH)
  //     .add(carolColl.sub(_$10_worthOfETH))
  //     .add(dennisColl.sub(_0pt5percent_dennisColl)).toString()

  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, '79163840000000000000'), 1000)

  //   // Liquidate troves A-D
  //   const liquidatorBalance_before = web3.utils.toBN(await web3.eth.getBalance(liquidator))
  //   await cdpManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })
  //   const liquidatorBalance_after = web3.utils.toBN(await web3.eth.getBalance(liquidator))

  //   console.log(`liquidatorBalance_before: ${liquidatorBalance_before}`)
  //   console.log(`liquidatorBalance_after: ${liquidatorBalance_after}`)

  //   // Check CLV in DefaultPool has decreased
  //   const CLVinDefaultPool_1 = await defaultPool.getCLVDebt()
  //   assert.isTrue(CLVinDefaultPool_1.gt(CLVinDefaultPool_0))

  //   // Check liquidator's balance has increased by the expected compensation amount
  //   const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()
  //   console.log(`expectedGasComp: ${expectedGasComp}`)
  //   console.log(`compensationReceived: ${compensationReceived}`)

  //   assert.isAtMost(th.getDifference(expectedGasComp, compensationReceived), 1000)

  //   // Check ETH in defaultPool now equals the expected liquidated collateral
  //   const ETHinDefaultPool = (await defaultPool.getETH()).toString()
  //   console.log(` expectedLiquidatedColl: ${expectedLiquidatedColl}`)
  //   console.log(` ETHinDefaultPool: ${ETHinDefaultPool}`)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, ETHinDefaultPool), 1000)
  // })

  // //  --- event emission in liquidation sequence ---
  // it('liquidateCDPs(): full offset. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
  //   await priceFeed.setPrice(dec(1000, 18))

  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans. A: 0.04 ETH, 1 CLV.  B: 1ETH, 180 CLV.  C: 5 ETH, 925 CLV.  D: 73.632 ETH, 13500 CLV.
  //   await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
  //   await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
  //   await borrowerOperations.openLoan('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

  //   await borrowerOperations.openLoan(dec(1, 23), erin, { from: erin, value: dec(1000, 'ether') })
  //   await borrowerOperations.openLoan(dec(1, 23), flyn, { from: flyn, value: dec(1000, 'ether') })

  //   // D, E each provide 10000 CLV to SP
  //   await poolManager.provideToSP(dec(1, 23), { from: erin })
  //   await poolManager.provideToSP(dec(1, 23), { from: flyn })

  //   const CLVinSP_0 = await stabilityPool.getCLV()

  //   // price drops to 200 
  //   await priceFeed.setPrice(dec(200, 18))
  //   const price = await priceFeed.getPrice()

  //   // Check not in Recovery Mode 
  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Check A, B, C, D have ICR < MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))

  //   // Check E, F have ICR > MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).gt(mv._MCR))


  //   // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const carolColl = (await cdpManager.CDPs(carol))[1]
  //   const dennisColl = (await cdpManager.CDPs(dennis))[1]

  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
  //   const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
  //   const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

  //   // Check A's collateral is < $10 in value
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of B, C and D are > $10 in value
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
  //   const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
  //   const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

  //   // Check collateral of A, B and C are < $10 in value
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of D is > $10 in value
  //   assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   const _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price)
  //   assert.equal(_$10_worthOfETH, '50000000000000000')

  //   /* Expect total gas compensation = 
  //   [A_coll + (2 * $10 worth of ETH ) + 0.5% of D_coll]
  //   = 0.04 + (2*0.05) + 0.36816
  //   = 0.50816 ETH
  //   */
  //   const expectedGasComp = aliceColl
  //     .add(_$10_worthOfETH)
  //     .add(_$10_worthOfETH)
  //     .add(_0pt5percent_dennisColl)

  //   console.log(`expectedGasComp: ${expectedGasComp}`)
  //   assert.isAtMost(th.getDifference(expectedGasComp, '508160000000000000'), 1000)

  //   /* Expect liquidated coll = 
  //   [ (B_coll - 0.05) + (C_coll - 0.05) + (D_coll - D_coll/200)]
  //   = 0.95 + 4.95 + 73.26384
  //   = 79.16384 ETH
  //   */
  //   const expectedLiquidatedColl = bobColl.sub(_$10_worthOfETH)
  //     .add(carolColl.sub(_$10_worthOfETH))
  //     .add(dennisColl.sub(_0pt5percent_dennisColl))

  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, '79163840000000000000'), 1000)

  //   // Expect liquidatedDebt = 1 + 180 + 925 + 13500 = 14606 CLV 
  //   const expectedLiquidatedDebt = '14606000000000000000000'

  //   // Liquidate troves A-D
  //   const liquidationTxData = await cdpManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })

  //   // Get data from the liquidation event logs
  //   const loggedLiquidatedDebt = liquidationTxData.logs[4].args[0]
  //   const loggedLiquidatedColl = liquidationTxData.logs[4].args[1]
  //   const loggedGasCompensation = liquidationTxData.logs[4].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedLiquidatedDebt), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedLiquidatedColl), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp, loggedGasCompensation), 1000)
  // })

  // it('liquidateCDPs(): full redistribution. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
  //   await priceFeed.setPrice(dec(1000, 18))

  //   await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(1, 24) })

  //   // A-E open loans. A: 0.04 ETH, 1 CLV.  B: 1ETH, 180 CLV.  C: 5 ETH, 925 CLV.  D: 73.632 ETH, 13500 CLV.
  //   await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: '40000000000000000' })
  //   await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(1, 'ether') })
  //   await borrowerOperations.openLoan('925000000000000000000', carol, { from: carol, value: dec(5, 'ether') })
  //   await borrowerOperations.openLoan('13500000000000000000000', dennis, { from: dennis, value: '73632000000000000000' })

  //   const CLVinDefaultPool_0 = await defaultPool.getCLVDebt()

  //   // price drops to 200 
  //   await priceFeed.setPrice(dec(200, 18))
  //   const price = await priceFeed.getPrice()

  //   // Check not in Recovery Mode 
  //   assert.isFalse(await cdpManager.checkRecoveryMode())

  //   // Check A, B, C, D have ICR < MCR
  //   assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
  //   assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))

  //   // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
  //   const aliceColl = (await cdpManager.CDPs(alice))[1]
  //   const bobColl = (await cdpManager.CDPs(bob))[1]
  //   const carolColl = (await cdpManager.CDPs(carol))[1]
  //   const dennisColl = (await cdpManager.CDPs(dennis))[1]

  //   const aliceCollValueInUSD = (await borrowerOperationsTester.getUSDValue(aliceColl, price))
  //   const bobCollValueInUSD = (await borrowerOperationsTester.getUSDValue(bobColl, price))
  //   const carolCollValueInUSD = (await borrowerOperationsTester.getUSDValue(carolColl, price))
  //   const dennisCollValueInUSD = (await borrowerOperationsTester.getUSDValue(dennisColl, price))

  //   // Check A's collateral is < $10 in value
  //   assert.isTrue(aliceCollValueInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of B, C and D are > $10 in value
  //   assert.isTrue(bobCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollValueInUSD.gt(th.toBN(dec(10, 18))))
  //   assert.isTrue(dennisCollValueInUSD.gt(th.toBN(dec(10, 18))))

  //   // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
  //   const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
  //   const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

  //   const aliceCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_aliceColl, price))
  //   const bobCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_bobColl, price))
  //   const carolCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_carolColl, price))
  //   const dennisCollFractionInUSD = (await borrowerOperationsTester.getUSDValue(_0pt5percent_dennisColl, price))

  //   // Check collateral of A, B and C are < $10 in value
  //   assert.isTrue(aliceCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(bobCollFractionInUSD.lt(th.toBN(dec(10, 18))))
  //   assert.isTrue(carolCollFractionInUSD.lt(th.toBN(dec(10, 18))))

  //   // Check collateral of D is > $10 in value
  //   assert.isTrue(dennisCollFractionInUSD.gt(th.toBN(dec(10, 18))))

  //   const _$10_worthOfETH = await cdpManagerTester.getMinVirtualDebtInETH(price)
  //   assert.equal(_$10_worthOfETH, '50000000000000000')

  //   /* Expect total gas compensation = 
  //   [A_coll + (2 * $10 worth of ETH ) + 0.5% of D_coll]
  //   = 0.04 + (2*0.05) + 0.36816
  //   = 0.50816 ETH
  //   */
  //   const expectedGasComp = aliceColl
  //     .add(_$10_worthOfETH)
  //     .add(_$10_worthOfETH)
  //     .add(_0pt5percent_dennisColl).toString()

  //   assert.isAtMost(th.getDifference(expectedGasComp, '508160000000000000'), 1000)

  //   /* Expect liquidated coll = 
  //   [ (B_coll - 0.05) + (C_coll - 0.05) + (D_coll - D_coll/200)]
  //   = 0.95 + 4.95 + 73.26384
  //   = 79.16384 ETH
  //   */
  //   const expectedLiquidatedColl = bobColl.sub(_$10_worthOfETH)
  //     .add(carolColl.sub(_$10_worthOfETH))
  //     .add(dennisColl.sub(_0pt5percent_dennisColl)).toString()

  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, '79163840000000000000'), 1000)

  //   // Expect liquidatedDebt = 1 + 180 + 925 + 13500 = 14606 CLV 
  //   const expectedLiquidatedDebt = '14606000000000000000000'

  //   // Liquidate troves A-D
  //   const liquidationTxData = await cdpManager.liquidateCDPs(4, { from: liquidator, gasPrice: 0 })

  //   // Get data from the liquidation event logs
  //   const loggedLiquidatedDebt = liquidationTxData.logs[4].args[0]
  //   const loggedLiquidatedColl = liquidationTxData.logs[4].args[1]
  //   const loggedGasCompensation = liquidationTxData.logs[4].args[2]

  //   assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedLiquidatedDebt), 1000)
  //   assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedLiquidatedColl), 1000)
  //   assert.isAtMost(th.getDifference(expectedGasComp, loggedGasCompensation), 1000)
  // })

  // --- Trove ordering by ICR tests ---

  it('Trove ordering: same collateral, decreasing debt. Price successively increases. Troves should maintain ordering by ICR', async () => {
    const _10_accounts = accounts.slice(1, 11)

    let debt = 100
    // create 10 troves, constant coll, descending debt 100 to 90 CLV
    for (account of _10_accounts) {

      const debtString = debt.toString().concat('000000000000000000')
      await borrowerOperations.openLoan(debtString, account, { from: account, value: dec(1, 'ether') })

      const squeezedTroveAddr = th.squeezeAddr(account)

      debt -= 1
    }

    const initialPrice = await priceFeed.getPrice()
    const firstColl = (await cdpManager.CDPs(_10_accounts[0]))[1]
    console.log(`initialPrice: ${initialPrice}`)
    console.log(`firstTroveColl: ${(await cdpManager.CDPs(_10_accounts[0]))[1]}`)
    console.log(`firstTroveDebt: ${(await cdpManager.CDPs(_10_accounts[0]))[0]}`)
    console.log(`firstTrove_gasCompensation: ${await cdpManagerTester.getGasCompensation(firstColl, initialPrice)}`)
    console.log(`firstTrove_ICR: ${await cdpManager.getCurrentICR(_10_accounts[0], initialPrice)}`)

    // Vary price 200-210
    let price = 200
    while (price < 210) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []
      const coll_firstTrove = (await cdpManager.CDPs(_10_accounts[0]))[1]
      const gasComp_firstTrove = (await cdpManagerTester.getGasCompensation(coll_firstTrove, priceString)).toString()

      for (account of _10_accounts) {
        // Check gas compensation is the same for all troves
        const coll = (await cdpManager.CDPs(account))[1]
        const gasCompensation = (await cdpManagerTester.getGasCompensation(coll, priceString)).toString()

        assert.equal(gasCompensation, gasComp_firstTrove)

        const ICR = await cdpManager.getCurrentICR(account, price)
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
    // create 20 troves, increasing collateral, constant debt = 100CLV
    for (account of _20_accounts) {

      const collString = coll.toString().concat('000000000000000000')
      await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: collString })

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
        const ICR = await cdpManager.getCurrentICR(account, price)
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
      await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: collString })

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
        const ICR = await cdpManager.getCurrentICR(account, price)
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

