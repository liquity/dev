const Decimal = require("decimal.js");
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
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
})

