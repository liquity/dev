const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const dec = th.dec
const moneyVals = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
 
  const [owner] = accounts;
  let priceFeed;
  let clvToken;
  let poolManager;
  let sortedCDPs;
  let cdpManager;
  let nameRegistry;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let functionCaller;
  let borrowerOperations;
  let hintHelpers;

  let numAccounts;
  let price;

  /* Open a CDP for each account. CLV debt is 200 CLV each, with collateral beginning at 
  1.5 ether, and rising by 0.01 ether per CDP.  Hence, the ICR of account (i + 1) is always 1% greater than the ICR of account i. 
 */

 // Open CDPs in parallel, then withdraw CLV in parallel
 const makeCDPsInParallel = async (accounts, n) => {
  activeAccounts = accounts.slice(0,n)
  console.log(`number of accounts used is: ${activeAccounts.length}`)
  console.time("makeCDPsInParallel")
  const openCDPpromises = activeAccounts.map((account, index) => openCDP(account, index))
  await Promise.all(openCDPpromises)
  const withdrawCLVpromises = activeAccounts.map(account => withdrawCLVfromCDP(account))
  await Promise.all(withdrawCLVpromises)
  console.timeEnd("makeCDPsInParallel")
 }

 const openCDP = async (account, index) => {
   const amountFinney = 2000 + index * 10
   const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
   await borrowerOperations.openLoan(0, account, { from: account, value: coll })
 }

 const withdrawCLVfromCDP = async (account) => {
  await borrowerOperations.withdrawCLV('200000000000000000000', account, { from: account })
 }

 // Sequentially add coll and withdraw CLV, 1 account at a time
   const makeCDPsInSequence = async (accounts, n) => {
    activeAccounts = accounts.slice(0,n)
    console.log(`number of accounts used is: ${activeAccounts.length}`)

    let amountFinney = 2000

    console.time('makeCDPsInSequence')
    for (const account of activeAccounts) {
      const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
      await borrowerOperations.openLoan(0, account, { from: account, value: coll })
      await borrowerOperations.withdrawCLV('200000000000000000000', account, { from: account })
  
      amountFinney += 10
    }
    console.timeEnd('makeCDPsInSequence')
  }

  before(async () => {
    const contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)

    numAccounts = 10
    price = await priceFeed.getPrice()

    await makeCDPsInSequence(accounts, numAccounts) 
    // await makeCDPsInParallel(accounts, numAccounts)  
  })

  it("setup: makes accounts with ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = await cdpManager.getCurrentICR(accounts[0], price)
    const ICR_1 = await cdpManager.getCurrentICR(accounts[1], price)
    const ICR_2 = await cdpManager.getCurrentICR(accounts[2], price)
    const ICR_3 = await cdpManager.getCurrentICR(accounts[3], price)
    const ICR_4 = await cdpManager.getCurrentICR(accounts[4], price)
    const ICR_5 = await cdpManager.getCurrentICR(accounts[5], price)
    const ICR_6 = await cdpManager.getCurrentICR(accounts[6], price)
    const ICR_7 = await cdpManager.getCurrentICR(accounts[7], price)
    const ICR_8 = await cdpManager.getCurrentICR(accounts[8], price)
    const ICR_9 = await cdpManager.getCurrentICR(accounts[9], price)

    assert.isAtMost(th.getDifference(ICR_0, '2000000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_1, '2010000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_2, '2020000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_3, '2030000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_4, '2040000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_5, '2050000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_6, '2060000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_7, '2070000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_8, '2080000000000000000'), 100)
    assert.isAtMost(th.getDifference(ICR_9, '2090000000000000000'), 100)
  })

  it("getApproxHint(): returns the address of a CDP within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    /* As per the setup, the ICRs of CDPs are monotonic and seperated by 1% intervals. Therefore, the difference in ICR between 
    the given CR and the ICR of the hint address equals the number of positions between the hint address and the correct insert position 
    for a CDP with the given CR. */

    // CR = 250%
    const CR_250 = '2500000000000000000'
    const CRPercent_250 = Number(web3.utils.fromWei(CR_250, 'ether')) * 100

    // const hintAddress_250 = await functionCaller.cdpManager_getApproxHint(CR_250, sqrtLength * 10)
    const hintAddress_250 = await hintHelpers.getApproxHint(CR_250, sqrtLength * 10)
    const ICR_hintAddress_250 = await cdpManager.getCurrentICR(hintAddress_250, price)
    const ICRPercent_hintAddress_250 = Number(web3.utils.fromWei(ICR_hintAddress_250, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = (ICRPercent_hintAddress_250 - CRPercent_250)
    assert.isBelow(ICR_Difference_250, sqrtLength)

    // CR = 287% 
    const CR_287 = '2870000000000000000'
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, 'ether')) * 100

    // const hintAddress_287 = await functionCaller.cdpManager_getApproxHint(CR_287, sqrtLength * 10)
    const hintAddress_287 = await hintHelpers.getApproxHint(CR_287, sqrtLength * 10)
    const ICR_hintAddress_287 = await cdpManager.getCurrentICR(hintAddress_287, price)
    const ICRPercent_hintAddress_287 = Number(web3.utils.fromWei(ICR_hintAddress_287, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = (ICRPercent_hintAddress_287 - CRPercent_287)
    assert.isBelow(ICR_Difference_287, sqrtLength)

    // CR = 213%
    const CR_213 = '2130000000000000000'
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, 'ether')) * 100

    // const hintAddress_213 = await functionCaller.cdpManager_getApproxHint(CR_213, sqrtLength * 10)
    const hintAddress_213 = await hintHelpers.getApproxHint(CR_213, sqrtLength * 10)
    const ICR_hintAddress_213 = await cdpManager.getCurrentICR(hintAddress_213, price)
    const ICRPercent_hintAddress_213 = Number(web3.utils.fromWei(ICR_hintAddress_213, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = (ICRPercent_hintAddress_213 - CRPercent_213)
    assert.isBelow(ICR_Difference_213, sqrtLength)

     // CR = 201%
     const CR_201 = '2010000000000000000'
     const CRPercent_201 = Number(web3.utils.fromWei(CR_201, 'ether')) * 100
 
    //  const hintAddress_201 = await functionCaller.cdpManager_getApproxHint(CR_201, sqrtLength * 10)
     const hintAddress_201 = await hintHelpers.getApproxHint(CR_201, sqrtLength * 10)
     const ICR_hintAddress_201 = await cdpManager.getCurrentICR(hintAddress_201, price)
     const ICRPercent_hintAddress_201 = Number(web3.utils.fromWei(ICR_hintAddress_201, 'ether')) * 100
     
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_201 = (ICRPercent_hintAddress_201 - CRPercent_201)
     assert.isBelow(ICR_Difference_201, sqrtLength)
  })

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint address is within 
  sqrt(length) positions of where a CDP with that CR should be inserted. */
  // it("getApproxHint(): for 100 random CRs, returns the address of a CDP within sqrt(length) positions of the correct insert position", async () => {
  //   const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

  //   for (i = 0; i < 100; i++) {
  //     // get random ICR between 200% and (200 + numAccounts)%
  //     const min = 200
  //     const max = 200 + numAccounts
  //     const ICR_Percent = (Math.floor(Math.random() * (max - min) + min)) 

  //     // Convert ICR to a duint
  //     const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney') 
  
  //     const hintAddress = await hintHelpers.getApproxHint(ICR, sqrtLength * 10)
  //     const ICR_hintAddress = await cdpManager.getCurrentICR(hintAddress, price)
  //     const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100
      
  //     // check the hint position is at most sqrtLength positions away from the correct position
  //     ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
  //     assert.isBelow(ICR_Difference, sqrtLength)
  //   }
  // })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    // CR = Maximum value, i.e. 2**256 -1 
    const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    // const hintAddress_Max = await functionCaller.cdpManager_getApproxHint(CR_Max, sqrtLength * 10)
    const hintAddress_Max = await hintHelpers.getApproxHint(CR_Max, sqrtLength * 10)

    const ICR_hintAddress_Max = await cdpManager.getCurrentICR(hintAddress_Max, price)
    const ICRPercent_hintAddress_Max = Number(web3.utils.fromWei(ICR_hintAddress_Max, 'ether')) * 100

     const firstCDP = await sortedCDPs.getFirst()
     const ICR_FirstCDP = await cdpManager.getCurrentICR(firstCDP, price)
     const ICRPercent_FirstCDP = Number(web3.utils.fromWei(ICR_FirstCDP, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_Max = (ICRPercent_hintAddress_Max - ICRPercent_FirstCDP)
     assert.isBelow(ICR_Difference_Max, sqrtLength)
  })

  it("getApproxHint(): returns the tail of the list if the CR is lower than ICR of any CDP", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

     // CR = MCR
     const CR_Min = '1100000000000000000'

    //  const hintAddress_Min = await functionCaller.cdpManager_getApproxHint(CR_Min, sqrtLength * 10)
    const hintAddress_Min = await hintHelpers.getApproxHint(CR_Min, sqrtLength * 10)
    const ICR_hintAddress_Min = await cdpManager.getCurrentICR(hintAddress_Min, price)
    const ICRPercent_hintAddress_Min = Number(web3.utils.fromWei(ICR_hintAddress_Min, 'ether')) * 100

     const lastCDP = await sortedCDPs.getLast()
     const ICR_LastCDP = await cdpManager.getCurrentICR(lastCDP, price)
     const ICRPercent_LastCDP = Number(web3.utils.fromWei(ICR_LastCDP, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_Min = (ICRPercent_hintAddress_Min - ICRPercent_LastCDP)
     assert.isBelow(ICR_Difference_Min, sqrtLength)
  })
})

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.
