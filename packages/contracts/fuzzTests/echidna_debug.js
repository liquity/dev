const { TestHelper: { dec } } = require("../utils/testHelpers.js")

const EchidnaTester = artifacts.require('EchidnaTester')
const CDPManager = artifacts.require('CDPManager')

// run with:
// npx buidler --config buidler.config.echidna.js test fuzzTests/echidna_debug.js

contract('Echidna debugger', async accounts => {
  let echidnaTester
  let cdpManager

  before(async () => {
    echidnaTester = await EchidnaTester.new({ value: dec(11, 25) })
    cdpManager = await CDPManager.at(await echidnaTester.cdpManager())
  })

  it('openLoan', async () => {
    await echidnaTester.openLoanExt(
      '28533397325200555203581702704626658822751905051193839801320459908900876958892',
      '52469987802830075086048985199642144541375565475567220729814021622139768827880',
      '9388634783070735775888100571650283386615011854365252563480851823632223689886'
    )
  })

  it('openLoan', async () => {
    await echidnaTester.openLoanExt(
      '0',
      '0',
      '0'
    )
  })

  it.only('openLoan', async () => {
    const trove1 = echidnaTester.echdinaProxies(0)
    const trove2 = echidnaTester.echdinaProxies(1)

    const icr1_before = await cdpManager.getCurrentICR(trove1, '1000000000000000000')
    const icr2_before = await cdpManager.getCurrentICR(trove2, '1000000000000000000')
    console.log('Trove 1', icr1_before)
    console.log('Trove 2', icr2_before)

    await echidnaTester.openLoanExt('0', '0', '30540440604590048251848424')
    await echidnaTester.openLoanExt('1', '0', '0')
    await echidnaTester.setPrice('78051143795343077331468494330613608802436946862454908477491916')
    const icr1_after = await cdpManager.getCurrentICR(trove1, '1000000000000000000')
    const icr2_after = await cdpManager.getCurrentICR(trove2, '1000000000000000000')
    console.log('Trove 1', icr1_after)
    console.log('Trove 2', icr2_after)
  })
})
