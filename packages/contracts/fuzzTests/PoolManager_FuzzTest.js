const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract("PoolManager", async accounts => {

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
  let borrowerOperations

  let gasPriceInWei
  
  const performLiquidation = async (remainingDefaulters, liquidatedAccountsDict) => {
    if (remainingDefaulters.length === 0) { return }

    const randomDefaulterIndex = Math.floor(Math.random() * (remainingDefaulters.length))
    const randomDefaulter = remainingDefaulters[randomDefaulterIndex]

    const liquidatedCLV = (await cdpManager.CDPs(randomDefaulter))[0]
    const liquidatedETH = (await cdpManager.CDPs(randomDefaulter))[1]

    const price = await priceFeed.getPrice()
    const ICR = (await cdpManager.getCurrentICR(randomDefaulter, price)).toString()
    const ICRPercent = ICR.slice(0, ICR.length-16)
  
    const CLVinPoolBefore = await stabilityPool.getCLV()
    const liquidatedTx = await cdpManager.liquidate(randomDefaulter, { from: accounts[0] })
    const CLVinPoolAfter = await stabilityPool.getCLV()

    assert.isTrue(liquidatedTx.receipt.status)

    if (liquidatedTx.receipt.status) {
      liquidatedAccountsDict[randomDefaulter] = true
      remainingDefaulters.splice(randomDefaulterIndex, 1)
    }
    if (await cdpManager.checkRecoveryMode()) { console.log("recovery mode: TRUE") }
  
    console.log(`Liquidation. addr: ${th.squeezeAddr(randomDefaulter)} ICR: ${ICRPercent}% coll: ${liquidatedETH} debt: ${liquidatedCLV} SP CLV before: ${CLVinPoolBefore} SP CLV after: ${CLVinPoolAfter} tx success: ${liquidatedTx.receipt.status}`)
  }

  const performSPDeposit = async (depositorAccounts, currentDepositors, currentDepositorsDict) => {
    const randomIndex = Math.floor(Math.random() * (depositorAccounts.length))
    const randomDepositor = depositorAccounts[randomIndex]

    const userBalance = (await clvToken.balanceOf(randomDepositor))
    const maxCLVDeposit = userBalance.div(web3.utils.toBN('1000000000000000000'))

    const randomCLVAmount = th.randAmountInWei(1, maxCLVDeposit)

    const depositTx = await poolManager.provideToSP(randomCLVAmount, { from: randomDepositor })

    assert.isTrue(depositTx.receipt.status)

    if (depositTx.receipt.status && !currentDepositorsDict[randomDepositor]) {
        currentDepositorsDict[randomDepositor] = true
        currentDepositors.push(randomDepositor)
      }
  
    console.log(`SP deposit. addr: ${th.squeezeAddr(randomDepositor)} amount: ${randomCLVAmount} tx success: ${depositTx.receipt.status} `)
  }

  const randomOperation = async ( depositorAccounts,
                                  remainingDefaulters,
                                  currentDepositors,
                                  liquidatedAccountsDict,
                                  currentDepositorsDict,
                                ) => {
                            
    const randomSelection = Math.floor(Math.random() * 2)

    if (randomSelection === 0) {
      await performLiquidation(remainingDefaulters, liquidatedAccountsDict)

    } else if (randomSelection === 1) {
      await performSPDeposit(depositorAccounts, currentDepositors, currentDepositorsDict)
    }
  }

  const attemptWithdrawAllDeposits = async (currentDepositors) => {
    console.log("\n")
    console.log("--- Attempt to withdraw all deposits ---")
    console.log(`Depositors count: ${currentDepositors.length}`)

    for (depositor of currentDepositors) {
      const initialDeposit = await poolManager.initialDeposits(depositor)
      const finalDeposit = await poolManager.getCompoundedCLVDeposit(depositor)
      const ETHGain = await poolManager.getCurrentETHGain(depositor)
      const ETHinSP = (await stabilityPool.getETH()).toString()
      const CLVinSP = (await stabilityPool.getCLV()).toString()

      // Attempt to withdraw
      const withdrawalTx = await poolManager.withdrawFromSP(mv._1e36, { from: depositor })
      
      const ETHinSPAfter = (await stabilityPool.getETH()).toString()
      const CLVinSPAfter = (await stabilityPool.getCLV()).toString()

      console.log(`--Before withdrawal--
                    withdrawer addr: ${th.squeezeAddr(depositor)}
                     initial deposit: ${initialDeposit}
                     ETH gain: ${ETHGain}
                     ETH in SP: ${ETHinSP}
                     compounded deposit: ${finalDeposit} 
                     CLV in SP: ${CLVinSP}
                    --After withdrawal--
                     withdrawal tx success: ${withdrawalTx.receipt.status} 
                     ETH in SP: ${ETHinSPAfter}
                     CLV in SP: ${CLVinSPAfter}
                     `)
                     

       // Check each deposit can be withdrawn
       assert.isTrue(withdrawalTx.receipt.status)

    }
  }

  describe("Stability Pool Withdrawals", async () => {

    before(async () => {
      console.log(`Number of accounts: ${accounts.length}`)
    })

    beforeEach(async () => {
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

      const contractAddresses = getAddresses(contracts)
      await connectContracts(contracts, contractAddresses)
    })

    // mixed deposits/liquidations

    // ranges: low-low, low-high, high-low, high-high, full-full

    // full offsets, partial offsets
    // ensure full offset with whale2 in S
    // ensure partial offset with whale 3 in L
   
    it("Defaulters' Collateral in range [1, 1e8]. SP Deposits in range [100, 1e10]. ETH:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      const lastAccount = accounts[accounts.length - 1]
      await borrowerOperations.addColl(lastAccount, lastAccount, { from: lastAccount, value: mv._500billion_Ether })

      const numberOfOps = 1000
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1 , numberOfOps*2)

      const defaulterCollMin = 1
      const defaulterCollMax = 100000000
      const defaulterCLVProportionMin = 91
      const defaulterCLVProportionMax = 180

      const depositorCollMin = 1
      const depositorCollMax = 100000000
      const depositorCLVProportionMin = 100
      const depositorCLVProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        borrowerOperations,
        defaulterCLVProportionMin,
        defaulterCLVProportionMax,
        true)

      // account set S all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        borrowerOperations,
        depositorCLVProportionMin,
        depositorCLVProportionMax,
        true)

      // price drops, all L liquidateable
      await priceFeed.setPrice(mv._100e18);

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
                              remainingDefaulters,
                              currentDepositors,
                              liquidatedAccountsDict,
                              currentDepositorsDict)
      }

      const totalCLVDepositsBeforeWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalCLVDepositsAfterWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total CLV deposits before any withdrawals: ${totalCLVDepositsBeforeWithdrawals}`)
      console.log(`Total ETH rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining CLV deposits after withdrawals: ${totalCLVDepositsAfterWithdrawals}`)
      console.log(`Remaining ETH rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it("Defaulters' Collateral in range [1, 10]. SP Deposits in range [1e8, 1e10]. ETH:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      const lastAccount = accounts[accounts.length - 1]
      await borrowerOperations.addColl(lastAccount, lastAccount, { from: lastAccount, value: mv._500billion_Ether })

      const numberOfOps = 1000
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1 , numberOfOps*2)

      const defaulterCollMin = 1
      const defaulterCollMax = 10
      const defaulterCLVProportionMin = 91
      const defaulterCLVProportionMax = 180

      const depositorCollMin = 1000000
      const depositorCollMax = 100000000
      const depositorCLVProportionMin = 100
      const depositorCLVProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        borrowerOperations,
        defaulterCLVProportionMin,
        defaulterCLVProportionMax)

      // account set S all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        borrowerOperations,
        depositorCLVProportionMin,
        depositorCLVProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(mv._100e18);

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
                              remainingDefaulters,
                              currentDepositors,
                              liquidatedAccountsDict,
                              currentDepositorsDict) 
      }

      const totalCLVDepositsBeforeWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalCLVDepositsAfterWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total CLV deposits before any withdrawals: ${totalCLVDepositsBeforeWithdrawals}`)
      console.log(`Total ETH rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining CLV deposits after withdrawals: ${totalCLVDepositsAfterWithdrawals}`)
      console.log(`Remaining ETH rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it("Defaulters' Collateral in range [1e6, 1e8]. SP Deposits in range [100, 1000]. Every liquidation empties the Pool. ETH:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      const lastAccount = accounts[accounts.length - 1]
      await borrowerOperations.addColl(lastAccount, lastAccount, { from: lastAccount, value: mv._500billion_Ether })

      const numberOfOps = 1000
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1 , numberOfOps*2)

      const defaulterCollMin = 1000000
      const defaulterCollMax = 100000000
      const defaulterCLVProportionMin = 91
      const defaulterCLVProportionMax = 180

      const depositorCollMin = 1
      const depositorCollMax = 10
      const depositorCLVProportionMin = 100
      const depositorCLVProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        borrowerOperations,
        defaulterCLVProportionMin,
        defaulterCLVProportionMax)

      // account set S all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        borrowerOperations,
        depositorCLVProportionMin,
        depositorCLVProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(mv._100e18);

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
                              remainingDefaulters,
                              currentDepositors,
                              liquidatedAccountsDict,
                              currentDepositorsDict)
      }

      const totalCLVDepositsBeforeWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalCLVDepositsAfterWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total CLV deposits before any withdrawals: ${totalCLVDepositsBeforeWithdrawals}`)
      console.log(`Total ETH rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining CLV deposits after withdrawals: ${totalCLVDepositsAfterWithdrawals}`)
      console.log(`Remaining ETH rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })

    it.only("Defaulters' Collateral in range [1e6, 1e8]. SP Deposits in range [1e8 1e10]. ETH:USD = 100", async () => {
      // whale adds coll that holds TCR > 150%
      const lastAccount = accounts[accounts.length - 1]
      await borrowerOperations.addColl(lastAccount, lastAccount, { from: lastAccount, value: mv._500billion_Ether })

      // price drops, all L liquidateable
      const numberOfOps = 1000
      const defaulterAccounts = accounts.slice(1, numberOfOps)
      const depositorAccounts = accounts.slice(numberOfOps + 1 , numberOfOps*2)

      const defaulterCollMin = 1000000
      const defaulterCollMax = 100000000
      const defaulterCLVProportionMin = 91
      const defaulterCLVProportionMax = 180

      const depositorCollMin = 1000000
      const depositorCollMax = 100000000
      const depositorCLVProportionMin = 100
      const depositorCLVProportionMax = 100

      const remainingDefaulters = [...defaulterAccounts]
      const currentDepositors = []
      const liquidatedAccountsDict = {}
      const currentDepositorsDict = {}

      // setup:
      // account set L all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(defaulterCollMin,
        defaulterCollMax,
        defaulterAccounts,
        borrowerOperations,
        defaulterCLVProportionMin,
        defaulterCLVProportionMax)

      // account set S all add coll and withdraw CLV
      await th.openLoan_allAccounts_randomETH_randomCLV(depositorCollMin,
        depositorCollMax,
        depositorAccounts,
        borrowerOperations,
        depositorCLVProportionMin,
        depositorCLVProportionMax)

      // price drops, all L liquidateable
      await priceFeed.setPrice(mv._100e18);

      // Random sequence of operations: liquidations and SP deposits
      for (i = 0; i < numberOfOps; i++) {
        await randomOperation(depositorAccounts,
                              remainingDefaulters,
                              currentDepositors,
                              liquidatedAccountsDict,
                              currentDepositorsDict)
      }

      const totalCLVDepositsBeforeWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsBeforeWithdrawals = await stabilityPool.getETH()

      await attemptWithdrawAllDeposits(currentDepositors)

      const totalCLVDepositsAfterWithdrawals = await stabilityPool.getCLV()
      const totalETHRewardsAfterWithdrawals = await stabilityPool.getETH()

      console.log(`Total CLV deposits before any withdrawals: ${totalCLVDepositsBeforeWithdrawals}`)
      console.log(`Total ETH rewards before any withdrawals: ${totalETHRewardsBeforeWithdrawals}`)

      console.log(`Remaining CLV deposits after withdrawals: ${totalCLVDepositsAfterWithdrawals}`)
      console.log(`Remaining ETH rewards after withdrawals: ${totalETHRewardsAfterWithdrawals}`)

      console.log(`current depositors length: ${currentDepositors.length}`)
      console.log(`remaining defaulters length: ${remainingDefaulters.length}`)
    })
  })
})

