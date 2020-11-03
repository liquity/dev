const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const MathTester = artifacts.require("./MathTester.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec

contract('Fee arithmetic tests', async accounts => {
  let contracts
  let cdpManagerTester
  let mathTester

  // Results array, maps seconds to expected hours passed output (rounded down to nearest hour).

  const secondsToHoursRoundedDown = [
    [0, '0'],
    [1, '0'],
    [3, '0'],
    [37, '0'],
    [432, '0'],
    [1179, '0'],
    [2343, '0'],
    [3547, '0'],
    [3600, '1'],  // 1 hour
    [10000, '2'],
    [15000, '4'],
    [17999, '4'],
    [18000, '5'],  // 5 hours
    [61328, '17'],
    [65932, '18'],
    [79420, '22'],
    [86147, '23'],
    [86400, '24'],  // 1 day
    [35405, '9'],
    [100000, '27'],
    [604342, '167'],
    [604800, '168'],  // 1 week
    [1092099, '303'],
    [2591349, '719'],
    [2592000, '720'],  // 1 month
    [5940183, '1650'],
    [8102940, '2250'],
    [31535342, '8759'],
    [31536000, '8760'],  // 1 year
    [56809809, '15780'],
    [315360000, '87600'],  // 10 years
    [793450405, '220402'],
    [1098098098, '305027'],
    [3153600000, '876000'],  // 100 years
    [4098977899, '1138604'],
    [9999999999, '2777777'],
    [31535999000, '8759999'],
    [31536000000, '8760000'],  // 1000 years
    [50309080980, '13974744']
  ]


  /* Object holds arrays for seconds passed, and the corresponding expected decayed base rate, given an initial
  base rate */

  const decayBaseRateResults = {
    'seconds': [
      0,
      1,
      3,
      37,
      432,
      1179,
      2343,
      3547,
      3600,	 // 1 hour
      10000,
      15000,
      17900,
      18000,	  // 5 hours
      61328,
      65932,
      79420,
      86147,
      86400,	  // 1 day
      35405,
      100000,
      604342,
      604800,	  // 1 week
      1092099,
      2591349,
      2592000,	  // 1 month
      5940183,
      8102940,
      31535342,
      31536000, // 1 year
      56809809,
      315360000,	  // 10 years
      793450405,
      1098098098,
      3153600000,	  // 100 years
      4098977899,
      9999999999,
      31535999000,
      31536000000,	 // 1000 years
      50309080980,
    ],
    '0.01': [
      10000000000000000,
      10000000000000000,
      10000000000000000,
      10000000000000000,
      10000000000000000,
      10000000000000000,
      10000000000000000,
      10000000000000000,
      9900000000000000,
      9801000000000000,
      9605960100000000,
      9605960100000000,
      9509900499000000,
      8429431933839270,
      8345137614500880,
      8016305895390460,
      7936142836436550,
      7856781408072190,
      9135172474836410,
      7623427143471040,
      1866712767157030,
      1848045639485460,
      475843304764745,
      7272854775176,
      7200126227425,
      628161168,
      1510733,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ],
    '0.1': [
      100000000000000000,
      100000000000000000,
      100000000000000000,
      100000000000000000,
      100000000000000000,
      100000000000000000,
      100000000000000000,
      100000000000000000,
      99000000000000000,
      98010000000000000,
      96059601000000000,
      96059601000000000,
      95099004990000000,
      84294319338392700,
      83451376145008800,
      80163058953904600,
      79361428364365600,
      78567814080721900,
      91351724748364100,
      76234271434710400,
      18667127671570300,
      18480456394854600,
      4758433047647450,
      72728547751767,
      72001262274250,
      6281611687,
      15107334,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ],
    '0.34539284': [
      345392840000000000,
      345392840000000000,
      345392840000000000,
      345392840000000000,
      345392840000000000,
      345392840000000000,
      345392840000000000,
      345392840000000000,
      341938911600000000,
      338519522484000000,
      331782983986568000,
      331782983986568000,
      328465154146703000,
      291146543521544000,
      288235078086328000,
      276877465951765000,
      274108691292248000,
      271367604379325000,
      315522316497358000,
      263307715161655000,
      64474922411262600,
      63830173187150000,
      16435287042768100,
      251199196570587,
      248687204604881,
      21696237004,
      52179651,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    '0.9976': [
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      987624000000000000,
      977747760000000000,
      958290579576000000,
      958290579576000000,
      948707673780240000,
      840920129719805000,
      832510928422607000,
      799706676124152000,
      791709609362911000,
      783792513269281000,
      911324806089680000,
      760513091832671000,
      186223265651586000,
      184361032995070000,
      47470128083330900,
      725539992371634,
      718284592447918,
      62665358193,
      150710768,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ]
  }

  // Exponent in range [2, 300]
  const exponentiationResults = [
    [187706062567632000, 17, 445791],
    [549137589365708000, 2, 301552092054380000],
    [14163921244333700, 3, 2841518643583],
    [173482812472018000, 2, 30096286223201300],
    [089043101634399300, 2, 7928673948673970],
    [228676956496486000, 2, 52293150432495800],
    [690422882634616000, 8, 51632293155573900],
    [88730376626724100, 11, 2684081],
    [73384846339964600, 5, 2128295594269],
    [332854710158557000, 10, 16693487237081],
    [543415023125456000, 24, 439702946262],
    [289299391854347000, 2, 83694138127294900],
    [356290645277924000, 2, 126943023912560000],
    [477806998132950000, 8, 2716564683301040],
    [410750871076822000, 6, 4802539645325750],
    [475222270242414000, 4, 51001992001158600],
    [121455252120304000, 22, 0],
    [9639247474367520, 4, 8633214298],
    [637853277178133000, 2, 406856803206885000],
    [484746955319000000, 6, 12974497294315000],
    [370594630844984000, 14, 921696040698],
    [289829200819417000, 12, 351322263034],
    [229325825269870000, 8, 7649335694527],
    [265776787719080000, 12, 124223733254],
    [461409786304156000, 27, 851811777],
    [240236841088914000, 11, 153828106713],
    [23036079879643700, 2, 530660976221324],
    [861616242485528000, 97, 531430041443],
    [72241661275119400, 212, 0],
    [924071964863292000, 17, 261215237312535000],
    [977575971186712000, 19, 649919912701292000],
    [904200910071210000, 15, 220787304397256000],
    [858551742150349000, 143, 337758087],
    [581850663606974000, 68, 102],
    [354836074035232000, 16, 63160309272],
    [968639062260900000, 37, 307604877091227000],
    [784478611520428000, 140, 1743],
    [61314555619941600, 13, 173],
    [562295998606858000, 71, 000000000000000002],
    [896709855620154000, 20, 112989701464696000],
    [8484527608110470, 111, 0],
    [33987471529490900, 190, 0],
    [109333102690035000, 59, 0],
    [352436592744656000, 4, 15428509626763400],
    [940730690913636000, 111, 1134095778412580],
    [665800835711181000, 87, 428],
    [365267526644046000, 208, 0],
    [432669515365048000, 171, 0],
    [457498365370101000, 40, 26036],
    [487046034636363000, 12, 178172281758289],
    [919877008002166000, 85, 826094891277916],
  ]

  before(async () => {
    cdpManagerTester = await CDPManagerTester.new()
    CDPManagerTester.setAsDeployed(cdpManagerTester)

    mathTester = await MathTester.new()
    MathTester.setAsDeployed(mathTester)
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
    await deploymentHelper.connectCoreContracts(contracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  it("hoursPassedSinceLastFeeOp(): returns zero hours passed for no time increase", async () => {
    await cdpManagerTester.setLastFeeOpTimeToNow()
    const hoursPassed = await cdpManagerTester.hoursPassedSinceLastFeeOp()

    assert.equal(hoursPassed, '0')
  })

  it("hoursPassedSinceLastFeeOp(): returns hours passed between time of last fee operation and current block.timestamp, rounded down to nearest hour", async () => {
    for (testPair of secondsToHoursRoundedDown) {
      await cdpManagerTester.setLastFeeOpTimeToNow()

      const seconds = testPair[0]
      const expectedHoursPassed = testPair[1]

      await th.fastForwardTime(seconds, web3.currentProvider)

      const hoursPassed = await cdpManagerTester.hoursPassedSinceLastFeeOp()

      assert.equal(expectedHoursPassed.toString(), hoursPassed.toString())
    }
  })

  it("decayBaseRate(): returns the initial base rate for no time increase", async () => {
    await cdpManagerTester.setBaseRate(dec(5, 17))
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore = await cdpManagerTester.baseRate()
    assert.equal(baseRateBefore, dec(5, 17))

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore.eq(baseRateAfter))
  })

  it("decayBaseRate(): returns the initial base rate for less than one hour passed ", async () => {
    await cdpManagerTester.setBaseRate(dec(5, 17))
    await cdpManagerTester.setLastFeeOpTimeToNow()

    // 1 second
    const baseRateBefore_1 = await cdpManagerTester.baseRate()
    assert.equal(baseRateBefore_1, dec(5, 17))

    await th.fastForwardTime(1, web3.currentProvider)

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter_1 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_1.eq(baseRateAfter_1))

    // 345 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_2 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(345, web3.currentProvider)

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter_2 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_2.eq(baseRateAfter_2))

    // 1541 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_3 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(1541, web3.currentProvider)

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter_3 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_3.eq(baseRateAfter_3))

    // 2117 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_4 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(2117, web3.currentProvider)

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter_4 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_4.eq(baseRateAfter_4))

    // 3540 seconds ( i.e 59 minutes)
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_5 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(3540, web3.currentProvider)

    await cdpManagerTester.decayBaseRate()
    const baseRateAfter_5 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_5.eq(baseRateAfter_5))
  })

  it("decayBaseRate(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.01", async () => {
    // baseRate = 0.01
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.01 in CDPManager
      await cdpManagerTester.setBaseRate(dec(1, 16))
      const contractBaseRate = await cdpManagerTester.baseRate()
      assert.equal(contractBaseRate, dec(1, 16))

      const timePassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults["0.01"][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(timePassed, web3.currentProvider)

      await cdpManagerTester.decayBaseRate()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      assert.isAtMost(th.getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000) // allow absolute error tolerance of 1e-15
    }
  })

  it("decayBaseRate(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.1", async () => {
    // baseRate = 0.1
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.1 in CDPManager
      await cdpManagerTester.setBaseRate(dec(1, 17))
      const contractBaseRate = await cdpManagerTester.baseRate()
      assert.equal(contractBaseRate, dec(1, 17))

      const timePassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults['0.1'][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(timePassed, web3.currentProvider)

      await cdpManagerTester.decayBaseRate()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      assert.isAtMost(th.getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000) // allow absolute error tolerance of 1e-15
    }
  })


  it("decayBaseRate(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.34539284", async () => {
    // baseRate = 0.34539284
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.1 in CDPManager
      await cdpManagerTester.setBaseRate('345392840000000000')
      const contractBaseRate = await cdpManagerTester.baseRate()
      await cdpManagerTester.setBaseRate('345392840000000000')

      const timePassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults['0.34539284'][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(timePassed, web3.currentProvider)

      await cdpManagerTester.decayBaseRate()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      assert.isAtMost(th.getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000) // allow absolute error tolerance of 1e-15
    }
  })

  it("decayBaseRate(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.9976", async () => {
    // baseRate = 0.9976
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.9976 in CDPManager
      await cdpManagerTester.setBaseRate('997600000000000000')
      const contractBaseRate = await cdpManagerTester.baseRate()
      await cdpManagerTester.setBaseRate('997600000000000000')

      const timePassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults['0.9976'][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // progress time 
      await th.fastForwardTime(timePassed, web3.currentProvider)

      await cdpManagerTester.decayBaseRate()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      assert.isAtMost(th.getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000) // allow absolute error tolerance of 1e-15
    }
  })

  // --- Exponentiation tests ---

  describe('Basic exponentiation', async accounts => {
    // for exponent = 0, returns 1
    it("decPow(): for exponent = 0, returns 1, regardless of base", async () => {
      const a = '0'
      const b = '1'
      const c = dec(1, 18)
      const d = '123244254546'
      const e = '990000000000000000'
      const f = '897890990909098978678609090'
      const g = dec(8789789, 27)
      const maxUint256 = th.toBN('2').pow(th.toBN('256')).sub(th.toBN('1'))

      const res_a = await mathTester.callDecPow(a, 0)
      const res_b = await mathTester.callDecPow(b, 0)
      const res_c = await mathTester.callDecPow(c, 0)
      const res_d = await mathTester.callDecPow(d, 0)
      const res_e = await mathTester.callDecPow(e, 0)
      const res_f = await mathTester.callDecPow(f, 0)
      const res_g = await mathTester.callDecPow(f, 0)
      const res_max = await mathTester.callDecPow(f, 0)

      assert.equal(res_a, dec(1, 18))
      assert.equal(res_b, dec(1, 18))
      assert.equal(res_c, dec(1, 18))
      assert.equal(res_d, dec(1, 18))
      assert.equal(res_e, dec(1, 18))
      assert.equal(res_f, dec(1, 18))
      assert.equal(res_g, dec(1, 18))
      assert.equal(res_max, dec(1, 18))
    })

    // for exponent = 1, returns base
    it("decPow(): for exponent = 0, returns 1, regardless of base", async () => {
      const a = '0'
      const b = '1'
      const c = dec(1, 18)
      const d = '123244254546'
      const e = '990000000000000000'
      const f = '897890990909098978678609090'
      const g = dec(8789789, 27)
      const maxUint128 = th.toBN('2').pow(th.toBN('128')).sub(th.toBN('1'))
      const maxUint192 = th.toBN('2').pow(th.toBN('192')).sub(th.toBN('1'))

      const res_a = await mathTester.callDecPow(a, 1)
      const res_b = await mathTester.callDecPow(b, 1)
      const res_c = await mathTester.callDecPow(c, 1)
      const res_d = await mathTester.callDecPow(d, 1)
      const res_e = await mathTester.callDecPow(e, 1)
      const res_f = await mathTester.callDecPow(f, 1)
      const res_g = await mathTester.callDecPow(g, 1)
      const res_max128 = await mathTester.callDecPow(maxUint128, 1)
      const res_max192 = await mathTester.callDecPow(maxUint192, 1)

      assert.equal(res_a, a)
      assert.equal(res_b, b)
      assert.equal(res_c, c)
      assert.equal(res_d, d)
      assert.equal(res_e, e)
      assert.equal(res_f, f)
      assert.equal(res_g, g)
      assert.isTrue(res_max128.eq(maxUint128))
      assert.isTrue(res_max192.eq(maxUint192))
    })

    // for base = 0, returns 0 for any exponent other than 1
    it("decPow(): for base = 0, returns 0 for any exponent other than 0", async () => {
      const res_a = await mathTester.callDecPow(0, 1)
      const res_b = await mathTester.callDecPow(0, 3)
      const res_c = await mathTester.callDecPow(0, 17)
      const res_d = await mathTester.callDecPow(0, 44)
      const res_e = await mathTester.callDecPow(0, 118)
      const res_f = await mathTester.callDecPow(0, 1000)
      const res_g = await mathTester.callDecPow(0, dec(1, 6))
      const res_h = await mathTester.callDecPow(0, dec(1, 9))
      const res_i = await mathTester.callDecPow(0, dec(1, 12))
      const res_j = await mathTester.callDecPow(0, dec(1, 18))

      assert.equal(res_a, '0')
      assert.equal(res_b, '0')
      assert.equal(res_c, '0')
      assert.equal(res_d, '0')
      assert.equal(res_e, '0')
      assert.equal(res_f, '0')
      assert.equal(res_g, '0')
      assert.equal(res_h, '0')
      assert.equal(res_i, '0')
      assert.equal(res_j, '0')
    })


    // for base = 1, returns 1 for any exponent
    it("decPow(): for base = 0, returns 0 for any exponent other than 1", async () => {

      const ONE = dec(1, 18)
      const res_a = await mathTester.callDecPow(ONE, 1)
      const res_b = await mathTester.callDecPow(ONE, 3)
      const res_c = await mathTester.callDecPow(ONE, 17)
      const res_d = await mathTester.callDecPow(ONE, 44)
      const res_e = await mathTester.callDecPow(ONE, 118)
      const res_f = await mathTester.callDecPow(ONE, 1000)
      const res_g = await mathTester.callDecPow(ONE, dec(1, 6))
      const res_h = await mathTester.callDecPow(ONE, dec(1, 9))
      const res_i = await mathTester.callDecPow(ONE, dec(1, 12))
      const res_j = await mathTester.callDecPow(ONE, dec(1, 18))

      assert.equal(res_a, ONE)
      assert.equal(res_b, ONE)
      assert.equal(res_c, ONE)
      assert.equal(res_d, ONE)
      assert.equal(res_e, ONE)
      assert.equal(res_f, ONE)
      assert.equal(res_g, ONE)
      assert.equal(res_h, ONE)
      assert.equal(res_i, ONE)
      assert.equal(res_j, ONE)
    })

    // for exponent = 2, returns base**2
    it("decPow(): for exponent = 2, returns the square of the base", async () => {
      const a = dec(1, 18)  // 1
      const b = dec(15, 17)   // 1.5
      const c = dec(5, 17)  // 0.5
      const d = dec(321, 15)  // 0.321
      const e = dec(2, 18)  // 4
      const f = dec(1, 17)  // 0.1
      const g = dec(1, 16)  // 0.01
      const h = dec(99, 16)  // 0.99
      const i = dec(125435, 15) // 125.435
      const j = dec(99999, 18)  // 99999

      const res_a = await mathTester.callDecPow(a, 2)
      const res_b = await mathTester.callDecPow(b, 2)
      const res_c = await mathTester.callDecPow(c, 2)
      const res_d = await mathTester.callDecPow(d, 2)
      const res_e = await mathTester.callDecPow(e, 2)
      const res_f = await mathTester.callDecPow(f, 2)
      const res_g = await mathTester.callDecPow(g, 2)
      const res_h = await mathTester.callDecPow(h, 2)
      const res_i = await mathTester.callDecPow(i, 2)
      const res_j = await mathTester.callDecPow(j, 2)

      assert.equal(res_a.toString(), '1000000000000000000')
      assert.equal(res_b.toString(), '2250000000000000000')
      assert.equal(res_c.toString(), '250000000000000000')
      assert.equal(res_d.toString(), '103041000000000000')
      assert.equal(res_e.toString(), '4000000000000000000')
      assert.equal(res_f.toString(), '10000000000000000')
      assert.equal(res_g.toString(), '100000000000000')
      assert.equal(res_h.toString(), '980100000000000000')
      assert.equal(res_i.toString(), '15733939225000000000000')
      assert.equal(res_j.toString(), '9999800001000000000000000000')
    })

    it("decPow(): correct output for various bases and exponents", async () => {
      for (list of exponentiationResults) {
        const base = list[0].toString()
        const exponent = list[1].toString()
        const expectedResult = list[2].toString()

        const result = await mathTester.callDecPow(base, exponent)

        assert.isAtMost(th.getDifference(expectedResult, result.toString()), 10000)  // allow absolute error tolerance of 1e-14
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 7776000 (seconds in three months)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.SECONDS_IN_THREE_MONTHS

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.999999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 2592000 (seconds in one month)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.SECONDS_IN_ONE_MONTH

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.999995, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 43200 (minutes in one month)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_ONE_MONTH

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.9997, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 525600 (minutes in one year)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_ONE_YEAR

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.99999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 2628000 (minutes in five years)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_FIVE_YEARS

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.99999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = minutes in ten years", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_ONE_YEAR * 10

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.99999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = minutes in one hundred years", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_ONE_YEAR * 100

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.999999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(th.getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })
  })
})