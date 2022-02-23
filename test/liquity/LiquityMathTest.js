const VestaMathTester = artifacts.require("./VestaMathTester.sol")

contract('LiquityMath', async accounts => {
  let vestaMathTester
  beforeEach('deploy tester', async () => {
    vestaMathTester = await VestaMathTester.new()
  })

  const checkFunction = async (func, cond, params) => {
    assert.equal(await vestaMathTester[func](...params), cond(...params))
  }

  it('max works if a > b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 1])
  })

  it('max works if a = b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 2])
  })

  it('max works if a < b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [1, 2])
  })
})
