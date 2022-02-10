const Decimal = require("decimal.js");
const { BNConverter } = require("./../../utils/BNConverter.js")
const testHelpers = require("./../../utils/testHelpers.js")
const PriceFormula = artifacts.require("./PriceFormula.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

contract('PriceFormula tests', async accounts => {
  let priceFormula
 
  before(async () => {
    priceFormula = await PriceFormula.new()
  })

  // numbers here were taken from the return value of mainnet contract

  it("check price 0", async () => {
    const xQty = "1234567891"
    const xBalance = "321851652450"
    const yBalance = "219413622039"
    const A = 200
    const ret = await priceFormula.getReturn(xQty, xBalance, yBalance, A);
    const retAfterFee = ret.sub(ret.mul(toBN(4000000)).div(toBN(10**10)))
    assert.equal(retAfterFee.toString(10), '1231543859')
  })

  it("fuzzy", async () => {
    const A = 3
    const aStep = 7
    const xQty     = "1234567891"
    const xBalance = "321851652450"
    const yBalance = "219413622039"

    const As = []
    const xQtys = []
    const xBalances = []
    const yBalances = []

    const excpectedResult = [1188895769, 2411018031, 3638812385, 4868601476, 6099325960, 7330566424, 8562123398, 9793889769, 11025802785, 12257823179, 13489925074, 14722090684, 15954307349, 17186565794, 18418859045, 19651181742, 20883529689, 22115899540, 23348288590, 24580694617, 25813115778, 27045550524, 28277997542, 29510455706, 30742924044, 31975401710, 33207887963, 34440382148, 35672883685, 36905392053, 38137906789, 39370427472, 40602953723, 41835485196, 43068021577, 44300562576, 45533107928, 46765657391, 47998210737, 49230767758, 50463328261, 51695892065, 52928459002, 54161028915, 55393601657, 56626177090, 57858755085, 59091335520, 60323918281, 61556503261, 62789090357, 64021679473, 65254270518, 66486863407, 67719458057, 68952054392, 70184652337, 71417251823, 72649852784, 73882455156, 75115058879, 76347663896, 77580270153, 78812877597, 80045486178, 81278095850, 82510706566, 83743318283, 84975930960, 86208544556, 87441159035, 88673774360, 89906390495, 91139007408, 92371625066, 93604243438, 94836862496, 96069482210, 97302102554, 98534723502, 99767345029, 100999967109, 102232589722, 103465212843, 104697836453, 105930460530, 107163085054, 108395710007, 109628335370, 110860961126, 112093587257, 113326213748, 114558840582, 115791467745, 117024095222, 118256722999, 119489351063, 120721979399, 121954607997, 123187236843]    

    assert(almost("123456", "123456"))
    assert(almost("123455", "123456"))    
    assert(almost("123455", "123454"))
    assert(!almost("123455", "123453"))    
    assert(!almost("123451", "123453"))

    for(let i = 0 ; i < 100 ; i++) {
      const newA = A + aStep*(i+1)
      const qty = web3.utils.toBN(xQty).mul(toBN(i+1))
      const xbalance = web3.utils.toBN(xBalance).add(qty.mul(toBN(3)))
      const ybalance = web3.utils.toBN(yBalance).add(qty)

      console.log(newA.toString(), qty.toString(), xbalance.toString(), ybalance.toString())

      console.log(i)
      const ret = await priceFormula.getReturn(qty.toString(), xbalance.toString(), ybalance.toString(), newA);
      console.log(ret.toString(), excpectedResult[i], Number(web3.utils.fromWei(ret.toString())) - Number(web3.utils.fromWei(excpectedResult[i].toString())))
      assert(almost(ret, excpectedResult[i]))
      //assert.equal(ret.toString(), (excpectedResult[i] - 1).toString())

      As.push(newA)
      xQtys.push(qty.toString())
      xBalances.push(xbalance.toString())
      yBalances.push(ybalance.toString())
    }

    //console.log("A = [", As.toString(), "]")
    //console.log("dx = [", xQtys.toString(), "]")
    //console.log("x = [", xBalances.toString(), "]")        
    //console.log("y = [", yBalances.toString(), "]")
  })  
})

function almost(n1, n2) {
  const x = toBN(n1)
  const y = toBN(n2)

  if(x.toString() === y.toString()) return true
  if(x.add(toBN(1)).toString() === y.toString()) return true
  if(y.add(toBN(1)).toString() === x.toString()) return true

  return false
}

