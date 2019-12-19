const CDPManager = artifacts.require("./CDPManager.sol")
const PoolManager = artifacts.require("./PoolManager.sol")

// Test functionality through CDPManager, which DeciMathBasic library is linked to 
contract('CDPManager', async accounts => {
  
  let cdpManager
  let poolManager

  beforeEach(async () => {
    cdpManager = await CDPManager.deployed()
    poolManager = await PoolManager.deployed()
  })

  describe('accurateMulDiv()', async => {

    it('accurateMulDiv(): is available in CDPManager and PoolManager', async () => {
      const a = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1, 1)).toString()
      assert.equal(a, '1000000000000000000')
      const b = (await poolManager.getAccurateMulDiv('1000000000000000000', 1, 1)).toString()
      assert.equal(a, '1000000000000000000')
    })

    it('accurateMulDiv(), basics: calculates the correct result', async () => {
      const a = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1, 1)).toString()
      assert.equal(a, '1000000000000000000')

      const b = (await cdpManager.getAccurateMulDiv('0', 1, 1)).toString()
      assert.equal(b, '0')

      const c = (await cdpManager.getAccurateMulDiv('1', 1, 1)).toString()
      assert.equal(c, '1')
    })

    it('accurateMulDiv(), repeating decimals: calculates the correct result', async () => {
      const a = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1000, 3)).toString()
      assert.equal(a, '333333333333333333333')

      const b = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1000, 9)).toString()
      assert.equal(b, '111111111111111111111')

      const c = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1000, 7)).toString()
      assert.equal(c, '142857142857142857142')
    })

    it('accurateMulDiv(): always rounds down', async () => {
      const a = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1000, 6)).toString()
      assert.equal(a, '166666666666666666666')

      const b = (await cdpManager.getAccurateMulDiv('2000000000000000000', 2000, 15)).toString()
      assert.equal(b, '266666666666666666666')

      const c = (await cdpManager.getAccurateMulDiv('1000000000000000000', 8000, 9)).toString()
      assert.equal(c, '888888888888888888888')

      const d = (await cdpManager.getAccurateMulDiv('10000000000000000000', 1000, 11)).toString()
      assert.equal(d, '909090909090909090909')

      const e = (await cdpManager.getAccurateMulDiv('1000000000000000000', 1000, 7)).toString()
      assert.equal(e, '142857142857142857142')

      const f = (await cdpManager.getAccurateMulDiv('1', 1, 2)).toString()
      assert.equal(f, '0')
    })

    it('accurateMulDiv(): reverts for div-by-0', async () => {
      try {
        const a = (await cdpManager.getAccurateMulDiv('1', 1000, 0)).toString()
        assert.fail()
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const b = (await cdpManager.getAccurateMulDiv('112402340234', 12345, 0)).toString()
        assert.fail()
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const c = (await cdpManager.getAccurateMulDiv('0', 1, 0)).toString()
        assert.fail()
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })
  })
})

contract('Reset chain state', async accounts => {})