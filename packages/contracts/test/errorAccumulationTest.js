const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const testHelpers = require("../utils/testHelpers.js")

const moneyVals = testHelpers.MoneyValues
// const getDifference = testHelpers.getDifference
// const getGasMetrics = testHelpers.getGasMetrics
const provideToSP_allAccounts = testHelpers.provideToSP_allAccounts
const openLoan_allAccounts = testHelpers.openLoan_allAccounts
const openLoan_allAccounts_randomETH = testHelpers.openLoan_allAccounts_randomETH
const openLoan_allAccounts_randomETH_ProportionalCLV = testHelpers.openLoan_allAccounts_randomETH_ProportionalCLV
const provideToSP_allAccounts_randomAmount = testHelpers.provideToSP_allAccounts_randomAmount

const randAmountInWei = testHelpers.randAmountInWei

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry


contract('CDPManager', async accounts => {
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller

  beforeEach(async () => {
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

    contracts = {
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
  })

  // --- Check accumulation from repeatedly applying rewards ---

  it("11 accounts with random coll. 1 liquidation. 10 accounts do CDP operations (apply rewards)", async () => {
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })
    await cdpManager.openLoan(moneyVals._180e18, accounts[0], { from: accounts[0], value: moneyVals._1_Ether })

    await openLoan_allAccounts_randomETH(1, 2, accounts.slice(1, 10), cdpManager, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      // apply rewards
      cdpManager.addColl(account, account, { from: account, value: 1 })
    }

    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const CLVDebt_DefaultPool = await defaultPool.getCLV()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`CLVDebt left in Default Pool is: ${CLVDebt_DefaultPool}`)
  })
  /*
  ABDK:
  ETH left in Default Pool is: 34
  CLVDebt left in Default Pool is: 98
  */

  it("101 accounts with random coll. 1 liquidation. 100 accounts do a CDP operation (apply rewards)", async () => {
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._1000_Ether })
    await cdpManager.openLoan(moneyVals._180e18, accounts[0], { from: accounts[0], value: moneyVals._1_Ether })

    await openLoan_allAccounts_randomETH(1, 2, accounts.slice(1, 100), cdpManager, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 100)) {
      // apply rewards
      cdpManager.addColl(account, account, { from: account, value: 1 })
    }
   
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const CLVDebt_DefaultPool = await defaultPool.getCLV()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`CLVDebt left in Default Pool is: ${CLVDebt_DefaultPool}`)
  })
   /*
    ABDK:
    ETH left in Default Pool is: 908
    CLVDebt left in Default Pool is: 108
    */

  it("11 accounts. 1 liquidation. 10 accounts do CDP operations (apply rewards)", async () => {
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })

    await openLoan_allAccounts(accounts.slice(0, 10), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      // apply rewards
      cdpManager.addColl(account, account, { from: account, value: 1 })
    }

    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const CLVDebt_DefaultPool = await defaultPool.getCLV()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`CLVDebt left in Default Pool is: ${CLVDebt_DefaultPool}`)
  })
  /* With ABDK:
  ETH left in Default Pool is: 64
  CLVDebt left in Default Pool is: 75 */

  it("101 accounts. 1 liquidation. 100 accounts do CDP operations (apply rewards)", async () => {
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })

    await openLoan_allAccounts(accounts.slice(0, 99), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 99)) {
      // apply rewards
      cdpManager.addColl(account, account, { from: account, value: 1 })
    }
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })

    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const CLVDebt_DefaultPool = await defaultPool.getCLV()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`CLVDebt left in Default Pool is: ${CLVDebt_DefaultPool}`)
  })
  /* With ABDK:
  ETH left in Default Pool is: 100
  CLVDebt left in Default Pool is: 180 */

  it("1001 accounts. 1 liquidation. 1000 accounts do CDP operations (apply rewards)", async () => {
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._1000_Ether })

    await openLoan_allAccounts(accounts.slice(0, 999), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 999)) {
      // apply rewards
      cdpManager.addColl(account, account, { from: account, value: 1 })
    }
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })

    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const CLVDebt_DefaultPool = await defaultPool.getCLV()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`CLVDebt left in Default Pool is: ${CLVDebt_DefaultPool}:`)
  })
  /* With ABDK:
  ETH left in Default Pool is: 1000
  CLVDebt left in Default Pool is: 180: */


  // --- Error accumulation from repeated Liquidations  - pure distribution, empty SP  ---

  //  50 CDPs added 
  //  1 whale, supports TCR
  //  price drops
  //  loop: CDPs are liquidated. Coll and debt difference between (activePool - defaultPool) is

  it("11 accounts. 10 liquidations. Check (ActivePool - DefaultPool) differences", async () => {
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })

    await openLoan_allAccounts(accounts.slice(0, 11), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    let totalETHPoolDifference = web3.utils.toBN(0)
    let totalCLVDebtPoolDifference = web3.utils.toBN(0)

    for (account of accounts.slice(1, 11)) {
      const activePoolETH = await activePool.getETH()
      const activePoolCLVDebt = await activePool.getCLV()

      await cdpManager.liquidate(account)

      const defaultPoolETH = await defaultPool.getETH()
      const defaultPoolCLVDebt = await defaultPool.getCLV()

      totalETHPoolDifference.add(activePoolETH.sub(defaultPoolETH))
      totalCLVDebtPoolDifference.add(activePoolCLVDebt.sub(defaultPoolCLVDebt))
    }
    // Grab total liquidated coll and debt after liquidations

    console.log(`Accumulated ETH difference between Default and Active Pools is: ${totalETHPoolDifference}`)
    console.log(`Accumulated CLVDebt difference between Active and Default Pools is: ${totalCLVDebtPoolDifference}`)
  })
  /* ABDK64, no error correction:
  Accumulated ETH difference between Default and Active Pools is: 0
  Accumulated CLVDebt difference between Active and Default Pools is: 0
  */

  it("11 accounts. 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })

    await openLoan_allAccounts(accounts.slice(0, 11), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    for (account of accounts.slice(1, 11)) {
      await cdpManager.liquidate(account)
    }

    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalCLVRewards = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolCLVDebt = await defaultPool.getCLV()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`CLVDebt difference between total pending rewards and DefaultPool: ${CLVDebtRewardDifference} `)
  })
  /* ABDK64, no error correction:
  ETH difference between total pending rewards and DefaultPool: 700
  CLVDebt difference between total pending rewards and DefaultPool: 800
  */

  it("101 accounts. 100 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._1000_Ether })

    await openLoan_allAccounts(accounts.slice(0, 101), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    for (account of accounts.slice(1, 101)) {
      await cdpManager.liquidate(account)

    }
    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalCLVRewards = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolCLVDebt = await defaultPool.getCLV()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`CLVDebt difference between total pending rewards and DefaultPool: ${CLVDebtRewardDifference} `)
  })
  /* ABDK64, no error correction:
  ETH difference between total pending rewards and DefaultPool: 51000
  CLVDebt difference between total pending rewards and DefaultPool: 55000
  */

 it("11 accounts with random ETH and proportional CLV (180:1). 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
  await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })

  await openLoan_allAccounts_randomETH_ProportionalCLV(1, 2, accounts.slice(0, 11), cdpManager, 180)

  await priceFeed.setPrice(moneyVals._100e18)

  await cdpManager.liquidate(accounts[0])

  // Grab total active coll and debt before liquidations
  for (account of accounts.slice(1, 11)) {
    await cdpManager.liquidate(account)

  }
  const L_ETH = await cdpManager.L_ETH()
  const L_CLVDebt = await cdpManager.L_CLVDebt()

  const totalColl = await activePool.getETH()

  const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
  const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
  const totalCLVRewards = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)

  const defaultPoolETH = await defaultPool.getETH()
  const defaultPoolCLVDebt = await defaultPool.getCLV()

  const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
  const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards)

  console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
  console.log(`CLVDebt difference between total pending rewards and DefaultPool: ${CLVDebtRewardDifference} `)
})
 /* ABDK64, no error correction:
 ETH difference between total pending rewards and DefaultPool: 4500
CLVDebt difference between total pending rewards and DefaultPool: 8000
  */

  it("101 accounts with random ETH and proportional CLV (180:1). 100 liquidations. Check 1) (DefaultPool - totalDistributionRewards) difference, and 2) ", async () => {
    await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._1000_Ether })

    await openLoan_allAccounts_randomETH_ProportionalCLV(1, 2, accounts.slice(0, 101), cdpManager, 180)

    await priceFeed.setPrice(moneyVals._100e18)

    await cdpManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    for (account of accounts.slice(1, 101)) {
      await cdpManager.liquidate(account)
    }

    // check (DefaultPool  - totalRewards)
    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalCLVRewards = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolCLVDebt = await defaultPool.getCLV()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`CLVDebt difference between total pending rewards and DefaultPool: ${CLVDebtRewardDifference} `)
  })
  /* ABDK64, no error correction:
  ETH difference between total pending rewards and DefaultPool: 53900
  CLVDebt difference between total pending rewards and DefaultPool: 61000
  */

  // --- Error accumulation from repeated Liquidations - SP Pool, partial offsets  ---

  it("11 accounts. 10 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
   // Acct 99 opens loan with 100 CLV
    await cdpManager.addColl(accounts[99], accounts[99], { from: accounts[99], value: moneyVals._100_Ether })
    await cdpManager.withdrawCLV(moneyVals._100e18, accounts[99], {from: accounts[99]})
    
    await openLoan_allAccounts(accounts.slice(0, 11), cdpManager, moneyVals._1_Ether, moneyVals._180e18)

    await priceFeed.setPrice(moneyVals._100e18)
    await cdpManager.liquidate(accounts[0])

    // On loop: Account[99] adds 10 CLV to pool -> a trove gets liquidated and partially offset against SP, emptying the SP
    for (account of accounts.slice(1, 11)) {
      await poolManager.provideToSP(moneyVals._10e18, {from: account[99]})
      await cdpManager.liquidate(account)
    }
    // check (DefaultPool - totalRewards from distribution)
    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
    const totalETHRewards_Distribution = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalCLVRewards_Distribution = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolCLVDebt = await defaultPool.getCLV()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards_Distribution)
    const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards_Distribution)

    console.log(`ETH difference between total pending distribution rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`CLVDebt difference between total pending distribution rewards and DefaultPool: ${CLVDebtRewardDifference} `)
  })
  /* With ABDK:
  ETH difference between total pending distribution rewards and DefaultPool: 550
  CLVDebt difference between total pending distribution rewards and DefaultPool: 600
  */

  it("101 accounts. 100 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
    // Acct 99 opens loan with 100 CLV
     await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })
     await cdpManager.withdrawCLV(moneyVals._100e18, accounts[999], {from: accounts[999]})
     
     await openLoan_allAccounts(accounts.slice(0, 101), cdpManager, moneyVals._1_Ether, moneyVals._180e18)
 
     await priceFeed.setPrice(moneyVals._100e18)
     await cdpManager.liquidate(accounts[0])
 
     // On loop: Account[99] adds 10 CLV to pool -> a trove gets liquidated and partially offset against SP, emptying the SP
     for (account of accounts.slice(1, 101)) {
       await poolManager.provideToSP(moneyVals._10e18, {from: account[99]})
       await cdpManager.liquidate(account)
     }
     // check (DefaultPool - totalRewards from distribution)
     const L_ETH = await cdpManager.L_ETH()
     const L_CLVDebt = await cdpManager.L_CLVDebt()
 
     const totalColl = await activePool.getETH()
 
     const _1e18_BN = web3.utils.toBN(moneyVals._1e18)
     const totalETHRewards_Distribution = (totalColl.mul(L_ETH)).div(_1e18_BN)
     const totalCLVRewards_Distribution = (totalColl.mul(L_CLVDebt)).div(_1e18_BN)
 
     const defaultPoolETH = await defaultPool.getETH()
     const defaultPoolCLVDebt = await defaultPool.getCLV()
 
     const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards_Distribution)
     const CLVDebtRewardDifference = defaultPoolCLVDebt.sub(totalCLVRewards_Distribution)
 
     console.log(`ETH difference between total pending distribution rewards and DefaultPool: ${ETHRewardDifference} `)
     console.log(`CLVDebt difference between total pending distribution rewards and DefaultPool: ${CLVDebtRewardDifference} `)
   })
  /* With ABDK:
  ETH difference between total pending distribution rewards and DefaultPool: 7600 
  CLVDebt difference between total pending distribution rewards and DefaultPool: 8900
  */

  // --- Error accumulation from SP withdrawals ---

  it("11 accounts. 10 Borrowers add to SP. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens loan with 100 CLV
     await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })
     await cdpManager.withdrawCLV(moneyVals._100e18, accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a loan
     await cdpManager.openLoan(moneyVals._100e18, accounts[0],{from: accounts[0], value: moneyVals._1_Ether})

     // 9 Accounts open loans and provide to SP
     await openLoan_allAccounts(accounts.slice(1, 11), cdpManager, moneyVals._1_Ether, moneyVals._100e18)
     await provideToSP_allAccounts(accounts.slice(1,11), poolManager, moneyVals._50e18)
     
     await priceFeed.setPrice(moneyVals._100e18)
     await cdpManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 11)) {
       await poolManager.withdrawFromSP(moneyVals._50e18, {from: account})
     }

    /* Sometimes, the error causes the last CLV withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = moneyVals._100e18
    await poolManager.provideToSP(whaleSPDeposit, {from: accounts[999]} )
    
    await poolManager.withdrawFromSP(moneyVals._50e18, {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_CLV = await stabilityPool.getCLV()  

    const SP_CLV_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_CLV)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`CLV insufficiency in Stability Pool is ${SP_CLV_Insufficiency}`)
   })
   /* ABDK 
   // Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient CLV in Pool.
      Noticed when reward shares are recurring fractions.

    Error in ETH gain accumulates in the Pool.
    Surplus ETH left in in Stability Pool is 530
    CLV insufficiency in Stability Pool is 530
    */

   it("101 accounts. 100 Borrowers add to SP. 1 liquidation, 100 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens loan with 100 CLV
     await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })
     await cdpManager.withdrawCLV(moneyVals._100e18, accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a loan
     await cdpManager.openLoan(moneyVals._100e18, accounts[0],{from: accounts[0], value: moneyVals._1_Ether})

     // 9 Accounts open loans and provide to SP
     await openLoan_allAccounts(accounts.slice(1, 101), cdpManager, moneyVals._1_Ether, moneyVals._100e18)
     await provideToSP_allAccounts(accounts.slice(1,101), poolManager, moneyVals._50e18)
     
     await priceFeed.setPrice(moneyVals._100e18)
     await cdpManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await poolManager.withdrawFromSP(moneyVals._50e18, {from: account})
     }

    /* Sometimes, the error causes the last CLV withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = moneyVals._100e18
    await poolManager.provideToSP(whaleSPDeposit, {from: accounts[999]} )
    
    await poolManager.withdrawFromSP(moneyVals._50e18, {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_CLV = await stabilityPool.getCLV()  

    const SP_CLV_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_CLV)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`CLV insufficiency in Stability Pool is ${SP_CLV_Insufficiency}`)
   })
   /* ABDK:
   Surplus ETH left in in Stability Pool is 5300
   CLV insufficiency in Stability Pool is 5300
    */

   it.only("11 accounts. 10 Borrowers add to SP, random CLV amounts. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens loan with 100 CLV
     await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })
     await cdpManager.withdrawCLV(moneyVals._100e18, accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a loan
     await cdpManager.openLoan(moneyVals._100e18, accounts[0],{from: accounts[0], value: moneyVals._1_Ether})

     // 9 Accounts open loans and provide to SP
     await openLoan_allAccounts(accounts.slice(1, 11), cdpManager, moneyVals._1_Ether, moneyVals._100e18)
     await provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,11), poolManager)

     const account1SPDeposit = moneyVals._50e18
     await poolManager.provideToSP(account1SPDeposit, {from: accounts[1]} )
     
     await priceFeed.setPrice(moneyVals._100e18)
     await cdpManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     
     for (account of accounts.slice(2, 11)) {
       await poolManager.withdrawFromSP(moneyVals._100e18, {from: account})
     }

    /* Sometimes, the error causes the last CLV withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = moneyVals._100e18
    await poolManager.provideToSP(whaleSPDeposit, {from: accounts[999]} )
    
    await poolManager.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_CLV = await stabilityPool.getCLV()  

    const SP_CLV_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_CLV)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`CLV insufficiency in Stability Pool is ${SP_CLV_Insufficiency}`)
   })
   /* ABDK 
   // Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient CLV in Pool.
      Noticed when reward shares are recurring fractions.

    Error in ETH gain accumulates in the Pool.
    Surplus ETH left in in Stability Pool is 84
    CLV insufficiency in Stability Pool is 442
    */

   it.only("11 accounts. 10 Borrowers add to SP, random CLV amounts. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens loan with 100 CLV
     await cdpManager.addColl(accounts[999], accounts[999], { from: accounts[999], value: moneyVals._100_Ether })
     await cdpManager.withdrawCLV(moneyVals._100e18, accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a loan
     await cdpManager.openLoan(moneyVals._100e18, accounts[0],{from: accounts[0], value: moneyVals._1_Ether})

     // 9 Accounts open loans and provide to SP
     await openLoan_allAccounts(accounts.slice(1, 101), cdpManager, moneyVals._1_Ether, moneyVals._100e18)
     await provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,101), poolManager)

     const account1SPDeposit = moneyVals._50e18
     await poolManager.provideToSP(account1SPDeposit, {from: accounts[1]} )
     
     await priceFeed.setPrice(moneyVals._100e18)
     await cdpManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await poolManager.withdrawFromSP(moneyVals._100e18, {from: account})
     }

    /* Sometimes, the error causes the last CLV withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = moneyVals._100e18
    await poolManager.provideToSP(whaleSPDeposit, {from: accounts[999]} )
    
    await poolManager.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )

    const SP_ETH = await stabilityPool.getETH()
    const SP_CLV = await stabilityPool.getCLV()  

    const SP_CLV_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_CLV)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`CLV insufficiency in Stability Pool is ${SP_CLV_Insufficiency}`)
   })
   /* ABDK 
   Surplus ETH left in in Stability Pool is 3321
   CLV insufficiency in Stability Pool is 1112
  */ 
})
  /* --- TODO:
 
 - Stakes computations. Errors occur in stake = totalColl/totalStakes.  
 
 Two contributions to accumulated error:

 -Truncation in division (-)
 -Previous error baked in to totalStakes, reducing the denominator (+)

 Test to see if error is stable or grows. 

  -----
  Findings with ABDK64 throughout:
  -----

  1) Reward applications accumulate ETH and CLVDebt error in DefaultPool

  2) Liquidations accumulate ETH and CLVDebt error in DefaultPool

  3) Liquidations with partial offset send slightly too little to StabilityPool, and redistribute slightly too much
  
  4) StabilityPool Withdrawals accumulate ETH error in the StabilityPool

  5) StabilityPool Withdrawals can accumulate CLVLoss in the StabilityPool (i.e. they distribute too much CLV), and can block
  the final deposit withdrawal

  */

