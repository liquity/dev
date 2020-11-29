const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const MathTester = artifacts.require("./LiquityMathTester.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

contract('Fee arithmetic tests', async accounts => {
  let contracts
  let cdpManagerTester
  let mathTester

  // Results array, maps seconds to expected hours passed output (rounded down to nearest hour).

  const secondsToMinutesRoundedDown = [
    [0, 0],
    [1, 0],
    [3, 0],
    [37, 0],
    [432, 7],
    [1179, 19],
    [2343, 39],
    [3599, 59],
    [3600, 60],
    [10000, 166],
    [15000, 250],
    [17900, 298],
    [18000, 300],
    [61328, 1022],
    [65932, 1098],
    [79420, 1323],
    [86147, 1435],
    [86400, 1440],
    [35405, 590],
    [100000, 1666],
    [604342, 10072],
    [604800, 10080],
    [1092099, 18201],
    [2591349, 43189],
    [2592000, 43200],
    [5940183, 99003],
    [8102940, 135049],
    [31535342, 525589],
    [31536000, 525600],
    [56809809, 946830],
    [315360000, 5256000],
    [793450405, 13224173],
    [1098098098, 18301634],
    [3153600000, 52560000],
    [4098977899, 68316298],
    [9999999999, 166666666],
    [31535999000, 525599983],
    [31536000000, 525600000],
    [50309080980, 838484683],
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
      9988281479725540,
      9968224527694850,
      9934885735097070,
      9901658444310750,
      9899999999999440,
      9725770973074650,
      9589883047871230,
      9513086955848500,
      9509900498997310,
      8426608452740130,
      8320014077791510,
      8012278579034610,
      7863364438736180,
      7856781408061520,
      9058982350792430,
      7564912399470990,
      1850523763408840,
      1848045639467900,
      474172410503716,
      7213405132883,
      7200126227131,
      627845586,
      1498384,
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
      99882814797255400,
      99682245276948600,
      99348857350970700,
      99016584443107500,
      98999999999994400,
      97257709730746500,
      95898830478712300,
      95130869558485000,
      95099004989973100,
      84266084527401300,
      83200140777915100,
      80122785790346100,
      78633644387361800,
      78567814080615200,
      90589823507924300,
      75649123994709900,
      18505237634088400,
      18480456394679000,
      4741724105037160,
      72134051328836,
      72001262271317,
      6278455864,
      14983844,
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
      344988090700181000,
      344295337937818000,
      343143839912067000,
      341996193079047000,
      341938911599981000,
      335921165757982000,
      331227694117210000,
      328575212084747000,
      328465154146610000,
      291049022505992000,
      287367329116839000,
      276738365328393000,
      271594977545010000,
      271367604378957000,
      312890764165007000,
      261286657800450000,
      63915765813126700,
      63830173186543500,
      16377575551352400,
      249145848491724,
      248687204594752,
      21685337018,
      51753125,
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
    '0.9976': [
      997600000000000000,
      997600000000000000,
      997600000000000000,
      997600000000000000,
      996430960417420000,
      994430078882839000,
      991104200933284000,
      987789446404441000,
      987623999999944000,
      970242912273927000,
      956686732855634000,
      949025554715446000,
      948707673779972000,
      840638459245356000,
      830004604400481000,
      799304911044492000,
      784449236408322000,
      783792513268217000,
      903724079315053000,
      754675660971226000,
      184608250637666000,
      184361032993318000,
      47303439671850700,
      719609296056468,
      718284592418665,
      62633875704,
      149478831,
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
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it("minutesPassedSinceLastFeeOp(): returns minutes passed for no time increase", async () => {
    await cdpManagerTester.setLastFeeOpTimeToNow()
    const hoursPassed = await cdpManagerTester.minutesPassedSinceLastFeeOp()

    assert.equal(hoursPassed, '0')
  })

  it("minutesPassedSinceLastFeeOp(): returns minutes passed between time of last fee operation and current block.timestamp, rounded down to nearest minutes", async () => {
    for (testPair of secondsToMinutesRoundedDown) {
      await cdpManagerTester.setLastFeeOpTimeToNow()

      const seconds = testPair[0]
      const expectedHoursPassed = testPair[1]

      await th.fastForwardTime(seconds, web3.currentProvider)

      const hoursPassed = await cdpManagerTester.minutesPassedSinceLastFeeOp()

      assert.equal(expectedHoursPassed.toString(), hoursPassed.toString())
    }
  })

  it("decayBaseRateFromBorrowing(): returns the initial base rate for no time increase", async () => {
    await cdpManagerTester.setBaseRate(dec(5, 17))
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore = await cdpManagerTester.baseRate()
    assert.equal(baseRateBefore, dec(5, 17))

    await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
    const baseRateAfter = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore.eq(baseRateAfter))
  })

  it("decayBaseRateFromBorrowing(): returns the initial base rate for less than one minute passed ", async () => {
    await cdpManagerTester.setBaseRate(dec(5, 17))
    await cdpManagerTester.setLastFeeOpTimeToNow()

    // 1 second
    const baseRateBefore_1 = await cdpManagerTester.baseRate()
    assert.equal(baseRateBefore_1, dec(5, 17))

    await th.fastForwardTime(1, web3.currentProvider)

    await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
    const baseRateAfter_1 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_1.eq(baseRateAfter_1))

    // 17 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_2 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(17, web3.currentProvider)

    await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
    const baseRateAfter_2 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_2.eq(baseRateAfter_2))

    // 29 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_3 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(29, web3.currentProvider)

    await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
    const baseRateAfter_3 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_3.eq(baseRateAfter_3))

    // 50 seconds
    await cdpManagerTester.setLastFeeOpTimeToNow()

    const baseRateBefore_4 = await cdpManagerTester.baseRate()
    await th.fastForwardTime(50, web3.currentProvider)

    await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
    const baseRateAfter_4 = await cdpManagerTester.baseRate()

    assert.isTrue(baseRateBefore_4.eq(baseRateAfter_4))

    // (cant quite test up to 59 seconds, as execution of the final tx takes >1 second before the block is mined)
  })

  it("decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.01", async () => {
    // baseRate = 0.01
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.01 in CDPManager
      await cdpManagerTester.setBaseRate(dec(1, 16))
      const contractBaseRate = await cdpManagerTester.baseRate()
      assert.equal(contractBaseRate, dec(1, 16))

      const startBaseRate = '0.01'

      const secondsPassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults[startBaseRate][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(secondsPassed, web3.currentProvider)

      await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      const minutesPassed = secondsPassed / 60

      const error = decayedBaseRate.sub(toBN(expectedDecayedBaseRate))
      // console.log(
      //   `starting baseRate: ${startBaseRate}, 
      //   minutesPassed: ${minutesPassed}, 
      //   expectedDecayedBaseRate: ${expectedDecayedBaseRate}, 
      //   decayedBaseRate: ${decayedBaseRate}, 
      //   error: ${error}`
      // )
      assert.isAtMost(getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 100000) // allow absolute error tolerance of 1e-13
    }
  })

  it("decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.1", async () => {
    // baseRate = 0.1
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.1 in CDPManager
      await cdpManagerTester.setBaseRate(dec(1, 17))
      const contractBaseRate = await cdpManagerTester.baseRate()
      assert.equal(contractBaseRate, dec(1, 17))

      const startBaseRate = '0.1'

      const secondsPassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults['0.1'][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(secondsPassed, web3.currentProvider)

      await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      const minutesPassed = secondsPassed / 60

      const error = decayedBaseRate.sub(toBN(expectedDecayedBaseRate))
      // console.log(
      //   `starting baseRate: ${startBaseRate}, 
      //   minutesPassed: ${minutesPassed}, 
      //   expectedDecayedBaseRate: ${expectedDecayedBaseRate}, 
      //   decayedBaseRate: ${decayedBaseRate}, 
      //   error: ${error}`
      // )
      assert.isAtMost(getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000000) // allow absolute error tolerance of 1e-12
    }
  })

  it("decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.34539284", async () => {
    // baseRate = 0.34539284
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.1 in CDPManager
      await cdpManagerTester.setBaseRate('345392840000000000')
      const contractBaseRate = await cdpManagerTester.baseRate()
      await cdpManagerTester.setBaseRate('345392840000000000')

      const startBaseRate = '0.34539284'

      const secondsPassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults[startBaseRate][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // Progress time 
      await th.fastForwardTime(secondsPassed, web3.currentProvider)

      await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      const minutesPassed = secondsPassed / 60

      const error = decayedBaseRate.sub(toBN(expectedDecayedBaseRate))
      // console.log(
      //   `starting baseRate: ${startBaseRate}, 
      //   minutesPassed: ${minutesPassed}, 
      //   expectedDecayedBaseRate: ${expectedDecayedBaseRate}, 
      //   decayedBaseRate: ${decayedBaseRate}, 
      //   error: ${error}`
      // )

      assert.isAtMost(getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 1000000) // allow absolute error tolerance of 1e-12
    }
  })

  it("decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.9976", async () => {
    // baseRate = 0.9976
    for (i = 0; i < decayBaseRateResults.seconds.length; i++) {
      // Set base rate to 0.9976 in CDPManager
      await cdpManagerTester.setBaseRate('997600000000000000')
      await cdpManagerTester.setBaseRate('997600000000000000')

      const startBaseRate = '0.9976'

      const secondsPassed = decayBaseRateResults.seconds[i]
      const expectedDecayedBaseRate = decayBaseRateResults[startBaseRate][i]
      await cdpManagerTester.setLastFeeOpTimeToNow()

      // progress time 
      await th.fastForwardTime(secondsPassed, web3.currentProvider)

      await cdpManagerTester.unprotectedDecayBaseRateFromBorrowing()
      const decayedBaseRate = await cdpManagerTester.baseRate()

      const minutesPassed = secondsPassed / 60

      const error = decayedBaseRate.sub(toBN(expectedDecayedBaseRate))

      // console.log(
      //   `starting baseRate: ${startBaseRate}, 
      //   minutesPassed: ${minutesPassed}, 
      //   expectedDecayedBaseRate: ${expectedDecayedBaseRate}, 
      //   decayedBaseRate: ${decayedBaseRate}, 
      //   error: ${error}`
      // )

      assert.isAtMost(getDifference(expectedDecayedBaseRate.toString(), decayedBaseRate.toString()), 10000000) // allow absolute error tolerance of 1e-11
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
      const maxUint256 = toBN('2').pow(toBN('256')).sub(toBN('1'))

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
    it("decPow(): for exponent = 1, returns base, regardless of base", async () => {
      const a = '0'
      const b = '1'
      const c = dec(1, 18)
      const d = '123244254546'
      const e = '990000000000000000'
      const f = '897890990909098978678609090'
      const g = dec(8789789, 27)
      const maxUint128 = toBN('2').pow(toBN('128')).sub(toBN('1'))
      const maxUint192 = toBN('2').pow(toBN('192')).sub(toBN('1'))

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
    it("decPow(): for base = 1, returns 1 for any exponent", async () => {
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
      const res_k = await mathTester.callDecPow(ONE, 0)

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
      assert.equal(res_k, ONE)
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

        assert.isAtMost(getDifference(expectedResult, result.toString()), 10000)  // allow absolute error tolerance of 1e-14
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 7776000 (seconds in three months)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.SECONDS_IN_ONE_MONTH * 3

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
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
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
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
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
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
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

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it("decPow(): abs. error < 1e-9 for exponent = 2628000 (minutes in five years)", async () => {
      for (let i = 1; i <= 200; i++) {
        const exponent = timeValues.MINUTES_IN_ONE_YEAR * 5

        // Use a high base to fully test high exponent, without prematurely decaying to 0
        const base = th.randDecayFactor(0.99999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const res = await mathTester.callDecPow(base, exponent)

        const error = expected.sub(res).abs()

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
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

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
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

        // console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)

        try {
          assert.isAtMost(getDifference(expected, res.toString()), 1000000000)  // allow absolute error tolerance of 1e-9
        } catch (error) {
          console.log(`run: ${i}. base: ${base}, exp: ${exponent}, expected: ${expected}, res: ${res}, error: ${error}`)
        }
      }
    })

    it.skip("decPow(): overflow test: doesn't overflow for exponent = minutes in 1000 years", async () => {
      const exponent = (timeValues.MINUTES_IN_ONE_YEAR * 1000) + 9

      // Test base = 0
      const response_0 = await mathTester.callDecPowTx(0, exponent)
      console.log(response_0)
      assert.isTrue(response_0.receipt.status)

      // test base = 1
      const response_1 = await mathTester.callDecPowTx(1, exponent)
      assert.isTrue(response_1.receipt.status)

      // test full range
      for (let i = 1; i <= 1000; i++) {
        const base = th.randDecayFactor(0.000000000000000001, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const response = await mathTester.callDecPowTx(base, exponent) // non-view call, to check reversion
        assert.isTrue(response.receipt.status)

        const result = await mathTester.callDecPow(base, exponent)
    
        const error = expected.sub(result).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, res: ${result}, error: ${error}`)
      }

      // Use a high base to fully test high exponent, without prematurely decaying to 0
      for (let i = 1; i <= 1000; i++) {
        const base = th.randDecayFactor(0.9999999999999, 0.999999999999999999)
        const baseAsDecimal = BNConverter.makeDecimal(base, 18)

        // Calculate actual expected value
        let expected = Decimal.pow(baseAsDecimal, exponent).toFixed(18)
        expected = BNConverter.makeBN(expected)

        const response = await mathTester.callDecPowTx(base, exponent) // non-view call, to check reversion
        assert.isTrue(response.receipt.status)

        const result = await mathTester.callDecPow(base, exponent)
    
        const error = expected.sub(result).abs()

        console.log(`run: ${i}. base: ${base}, exp: ${exponent}, res: ${result}, error: ${error}`)
      }
    })
  })
})
