const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const DeciMath = artifacts.require("DeciMath")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

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

  let numAccounts;

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
   await cdpManager.addColl(account, account, { from: account, value: coll })
 }

 const withdrawCLVfromCDP = async (account) => {
  await cdpManager.withdrawCLV('200000000000000000000', account, { from: account })
 }

 // Sequentially add coll and withdraw CLV, 1 account at a time
   const makeCDPsInSequence = async (accounts, n) => {
    activeAccounts = accounts.slice(0,n)
    console.log(`number of accounts used is: ${activeAccounts.length}`)

    let amountFinney = 2000

    console.time('makeCDPsInSequence')
    for (const account of activeAccounts) {
      const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
      console.log("coll is" + coll)
      await cdpManager.addColl(account, account, { from: account, value: coll })
      await cdpManager.withdrawCLV('200000000000000000000', account, { from: account })
  
      amountFinney += 10
    }
    console.timeEnd('makeCDPsInSequence')
  }

  before(async () => {
    const deciMath = await DeciMath.new()
    DeciMath.setAsDeployed(deciMath)
    CDPManager.link(deciMath)
    PoolManager.link(deciMath)
    FunctionCaller.link(deciMath)
    
    priceFeed = await PriceFeed.new()
    clvToken = await CLVToken.new()
    poolManager = await PoolManager.new()
    sortedCDPs = await SortedCDPs.new()
    cdpManager = await CDPManager.new()
    nameRegistry = await NameRegistry.new()
    activePool = await ActivePool.new()
    stabilityPool = await StabilityPool.new()
    defaultPool = await DefaultPool.new()
    functionCaller = await FunctionCaller.new()

    DefaultPool.setAsDeployed(defaultPool)
    PriceFeed.setAsDeployed(priceFeed)
    CLVToken.setAsDeployed(clvToken)
    PoolManager.setAsDeployed(poolManager)
    SortedCDPs.setAsDeployed(sortedCDPs)
    CDPManager.setAsDeployed(cdpManager)
    NameRegistry.setAsDeployed(nameRegistry)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    FunctionCaller.setAsDeployed(functionCaller)

    const contracts = {
      priceFeed,
      clvToken,
      poolManager,
      sortedCDPs,
      cdpManager,
      nameRegistry,
      activePool,
      stabilityPool,
      defaultPool,
      functionCaller
    }

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)
    await connectContracts(contracts, registeredAddresses)

    numAccounts = 10
    await makeCDPsInSequence(accounts, numAccounts) 
    // await makeCDPsInParallel(accounts, numAccounts)  
  })

  it("setup: makes accounts with ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = (await cdpManager.getCurrentICR(accounts[0])).toString()
    const ICR_1 = (await cdpManager.getCurrentICR(accounts[1])).toString()
    const ICR_2 = (await cdpManager.getCurrentICR(accounts[2])).toString()
    const ICR_3 = (await cdpManager.getCurrentICR(accounts[3])).toString()
    const ICR_4 = (await cdpManager.getCurrentICR(accounts[4])).toString()
    const ICR_5 = (await cdpManager.getCurrentICR(accounts[5])).toString()
    const ICR_6 = (await cdpManager.getCurrentICR(accounts[6])).toString()
    const ICR_7 = (await cdpManager.getCurrentICR(accounts[7])).toString()
    const ICR_8 = (await cdpManager.getCurrentICR(accounts[8])).toString()
    const ICR_9 = (await cdpManager.getCurrentICR(accounts[9])).toString()

    assert.equal(ICR_0, '2000000000000000000')
    assert.equal(ICR_1, '2010000000000000000')
    assert.equal(ICR_2, '2020000000000000000')
    assert.equal(ICR_3, '2030000000000000000')
    assert.equal(ICR_4, '2040000000000000000')
    assert.equal(ICR_5, '2050000000000000000')
    assert.equal(ICR_6, '2060000000000000000')
    assert.equal(ICR_7, '2070000000000000000')
    assert.equal(ICR_8, '2080000000000000000')
    assert.equal(ICR_9, '2090000000000000000')
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
    const hintAddress_250 = await cdpManager.getApproxHint(CR_250, sqrtLength * 10)
    const ICR_hintAddress_250 = await cdpManager.getCurrentICR(hintAddress_250)
    const ICRPercent_hintAddress_250 = Number(web3.utils.fromWei(ICR_hintAddress_250, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = (ICRPercent_hintAddress_250 - CRPercent_250)
    assert.isBelow(ICR_Difference_250, sqrtLength)

    // CR = 287% 
    const CR_287 = '2870000000000000000'
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, 'ether')) * 100

    // const hintAddress_287 = await functionCaller.cdpManager_getApproxHint(CR_287, sqrtLength * 10)
    const hintAddress_287 = await cdpManager.getApproxHint(CR_287, sqrtLength * 10)
    const ICR_hintAddress_287 = await cdpManager.getCurrentICR(hintAddress_287)
    const ICRPercent_hintAddress_287 = Number(web3.utils.fromWei(ICR_hintAddress_287, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = (ICRPercent_hintAddress_287 - CRPercent_287)
    assert.isBelow(ICR_Difference_287, sqrtLength)

    // CR = 213%
    const CR_213 = '2130000000000000000'
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, 'ether')) * 100

    // const hintAddress_213 = await functionCaller.cdpManager_getApproxHint(CR_213, sqrtLength * 10)
    const hintAddress_213 = await cdpManager.getApproxHint(CR_213, sqrtLength * 10)
    const ICR_hintAddress_213 = await cdpManager.getCurrentICR(hintAddress_213)
    const ICRPercent_hintAddress_213 = Number(web3.utils.fromWei(ICR_hintAddress_213, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = (ICRPercent_hintAddress_213 - CRPercent_213)
    assert.isBelow(ICR_Difference_213, sqrtLength)

     // CR = 201%
     const CR_201 = '2010000000000000000'
     const CRPercent_201 = Number(web3.utils.fromWei(CR_201, 'ether')) * 100
 
    //  const hintAddress_201 = await functionCaller.cdpManager_getApproxHint(CR_201, sqrtLength * 10)
     const hintAddress_201 = await cdpManager.getApproxHint(CR_201, sqrtLength * 10)
     const ICR_hintAddress_201 = await cdpManager.getCurrentICR(hintAddress_201)
     const ICRPercent_hintAddress_201 = Number(web3.utils.fromWei(ICR_hintAddress_201, 'ether')) * 100
     
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_201 = (ICRPercent_hintAddress_201 - CRPercent_201)
     assert.isBelow(ICR_Difference_201, sqrtLength)
  })

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint address is within 
  sqrt(length) positions of where a CDP with that CR should be inserted. */
  it("getApproxHint(): for 100 random CRs, returns the address of a CDP within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    for (i = 0; i < 100; i++) {
      // get random ICR between 200% and (200 + numAccounts)%
      const min = 200
      const max = 200 + numAccounts
      const ICR_Percent = (Math.floor(Math.random() * (max - min) + min)) 
      console.log(`Run ${i}: random ICR is ${ICR_Percent}`)

      // Convert ICR to a duint
      const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney') 
      console.log(`ICR is ${ICR}`)
  
      const hintAddress = await cdpManager.getApproxHint(ICR, sqrtLength * 10)
      const ICR_hintAddress = await cdpManager.getCurrentICR(hintAddress)
      const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100
      
      // check the hint position is at most sqrtLength positions away from the correct position
      ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
      assert.isBelow(ICR_Difference, sqrtLength)
    }
  })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    // CR = Maximum value, i.e. 2**256 -1 
    const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    // const hintAddress_Max = await functionCaller.cdpManager_getApproxHint(CR_Max, sqrtLength * 10)
    const hintAddress_Max = await cdpManager.getApproxHint(CR_Max, sqrtLength * 10)

    const ICR_hintAddress_Max = await cdpManager.getCurrentICR(hintAddress_Max)
    const ICRPercent_hintAddress_Max = Number(web3.utils.fromWei(ICR_hintAddress_Max, 'ether')) * 100

     const firstCDP = await sortedCDPs.getFirst()
     const ICR_FirstCDP = await cdpManager.getCurrentICR(firstCDP)
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
    const hintAddress_Min = await cdpManager.getApproxHint(CR_Min, sqrtLength * 10)
    const ICR_hintAddress_Min = await cdpManager.getCurrentICR(hintAddress_Min)
    const ICRPercent_hintAddress_Min = Number(web3.utils.fromWei(ICR_hintAddress_Min, 'ether')) * 100

     const lastCDP = await sortedCDPs.getLast()
     const ICR_LastCDP = await cdpManager.getCurrentICR(lastCDP)
     const ICRPercent_LastCDP = Number(web3.utils.fromWei(ICR_LastCDP, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_Min = (ICRPercent_hintAddress_Min - ICRPercent_LastCDP)
     assert.isBelow(ICR_Difference_Min, sqrtLength)
  })
})

// Gas usage of getApproxHint():
// numTrials = sqrt(length) * k
// k = 10 ()
// (including +21k tx fee)

// 10 CDPs:  600k
// 100 CDPs: 1.6mil
// alternative implementation of getApproxHint() may be cheaper gas-wise. 

// Execution time (in Buidler):

// 100 CDPs: 17s
// 500 CDPs: 81s
// 1000 CDPs: 172s
// 5000 CDPs: 842s

