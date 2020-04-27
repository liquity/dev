const PoolManager = artifacts.require("./PoolManager.sol")
const DeciMath = artifacts.require("DeciMath")
const FunctionCaller = artifacts.require("FunctionCaller")

// Test functionality through functionCaller, which DeciMathBasic library is linked to 
contract('functionCaller', async accounts => {
  
  let functionCaller

  before(async() => {
    functionCaller = await FunctionCaller.new()
    FunctionCaller.setAsDeployed(functionCaller)
  })

  // describe('accurateMulDiv()', async => {
  //   it('accurateMulDiv(), basics: calculates the correct results', async () => {
  //     const a = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 1, 1)).toString()
  //     assert.equal(a, '1000000000000000000')

  //     const b = (await functionCaller.decimath_accurateMulDiv('0', 1, 1)).toString()
  //     assert.equal(b, '0')

  //     const c = (await functionCaller.decimath_accurateMulDiv('1', 1, 1)).toString()
  //     assert.equal(c, '1')
  //   })

  //   it('accurateMulDiv(), repeating decimals: calculates the correct results', async () => {
  //     const a = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 1000, 3)).toString()
  //     assert.equal(a, '333333333333333333333')

  //     const b = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 1000, 9)).toString()
  //     assert.equal(b, '111111111111111111111')

  //     const c = (await functionCaller.getAccurateMulDiv('1000000000000000000', 1000, 7)).toString()
  //     assert.equal(c, '142857142857142857142')
  //   })

  //   it('accurateMulDiv(): always rounds down', async () => {
  //     const a = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 1000, 6)).toString()
  //     assert.equal(a, '166666666666666666666')

  //     const b = (await functionCaller.decimath_accurateMulDiv('2000000000000000000', 2000, 15)).toString()
  //     assert.equal(b, '266666666666666666666')

  //     const c = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 8000, 9)).toString()
  //     assert.equal(c, '888888888888888888888')

  //     const d = (await functionCaller.decimath_accurateMulDiv('10000000000000000000', 1000, 11)).toString()
  //     assert.equal(d, '909090909090909090909')

  //     const e = (await functionCaller.decimath_accurateMulDiv('1000000000000000000', 1000, 7)).toString()
  //     assert.equal(e, '142857142857142857142')

  //     const f = (await functionCaller.decimath_accurateMulDiv('1', 1, 2)).toString()
  //     assert.equal(f, '0')
  //   })

  //   it('accurateMulDiv(): reverts for div-by-0', async () => {
  //     try {
  //       const a = (await functionCaller.decimath_accurateMulDiv('1', 1000, 0)).toString()     
  //     } catch (err) {
  //       assert.include(err.message, 'revert')
  //     }

  //     try {
  //       const b = (await functionCaller.decimath_accurateMulDiv('112402340234', 12345, 0)).toString()
  //     } catch (err) {
  //       assert.include(err.message, 'revert')
  //     }

  //     try {
  //       const c = (await functionCaller.decimath_accurateMulDiv('0', 1, 0)).toString()
  //     } catch (err) {
  //       assert.include(err.message, 'revert')
  //     }
  //   })
  // })
  
  it('getMin(): returns the minimum of two uints', async () => {
    const a = await functionCaller.getMin(3, 2)
    const b = await functionCaller.getMin(4, 10)
    const c = await functionCaller.getMin(5, 5)
    assert.equal(a, 2)
    assert.equal(b, 4)
    assert.equal(c, 5)
  })
})

contract('Reset chain state', async accounts => {})