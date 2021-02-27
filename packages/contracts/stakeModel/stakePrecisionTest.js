const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BNConverter = require("../utils/BNConverter.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("TroveManagerTester")

const th = testHelpers.TestHelper
const { randomInt, toBN, dec } = testHelpers.TestHelper
const { makeDecimal } = BNConverter.BNConverter

const fs = require('fs')

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed
  let troveManager
  let borrowerOperations

  let contracts
  let data = []

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployLUSDToken(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress)

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory
  })

  it.only("repeatedly add a fresh trove and liquidate it: reduces snapshots ratio over time", async () => {
    await priceFeed.setPrice(dec(2000, 18))
  
    // Setup: Make initial troves
    const numberOfTroves = 10 
    const trovesList = []
    const initialTroves = accounts.slice(0, numberOfTroves)

    let freshColl = toBN(dec(2, 18))
    let freshDebt = freshColl.mul(toBN(1000))

    for (const account of initialTroves) {
      await borrowerOperations.openTrove(th._100pct, freshDebt, account, account, { from: account, value: freshColl })
      trovesList.push(account)
    }

    await priceFeed.setPrice(dec(1000, 18))
    const price = await priceFeed.getPrice()

    // Scenario: alternately liquidate the most recent trove, and make a fresh one.
    let step = 0
    while (step < 10) {
      const freshIdx = numberOfTroves + step // index of fresh trove in global accounts list
      
      // Liquidate random trove
      await priceFeed.setPrice(dec(1000, 18))
     
      let liquidationFraction = 2
      let percentLiquidated
      let liquidatedColl
      let troveToLiq = trovesList[0]
  
      const totalCollateralBeforeLiq = await troveManager.getEntireSystemColl()
    
      troveToLiq = trovesList[trovesList.length-1] // liquidate last one

      const { 1: coll, 3: collReward } = await troveManager.getEntireDebtAndColl(troveToLiq)
      liquidatedColl = coll.add(collReward)

         percentLiquidated = 
          makeDecimal(
            liquidatedColl
              .mul(toBN(dec(100, 18)))
              .div(totalCollateralBeforeLiq),
            18
          )

      // console.log(`trove to liq: ${troveToLiq}`)
      await troveManager.liquidate(troveToLiq)
      await trovesList.pop()

      console.log(`liquidated coll: ${makeDecimal(liquidatedColl, 18)}`)
      console.log(`total coll pre-liq: ${makeDecimal(totalCollateralBeforeLiq, 18)}`)
      console.log(`percent liquidated: ${percentLiquidated}`)

      // Make fresh trove to keep same number of troves
      await priceFeed.setPrice(dec(2000, 18))
      const freshBorrower = accounts[freshIdx]
      // Make coll of next fresh trove some fraction of total collateral. This determines the rate of stakes decrease.
      freshColl = totalCollateralBeforeLiq.div(toBN(liquidationFraction)) 
      freshDebt = freshColl.mul(toBN(1000))
      
      await borrowerOperations.openTrove(th._100pct, freshDebt, freshBorrower, freshBorrower, { from: freshBorrower, value: freshColl })
      trovesList.push(freshBorrower)

  
      const totalStakesSnapshot = await troveManager.totalStakesSnapshot()
      const totalCollateralSnapshot = await troveManager.totalCollateralSnapshot()
      const snapshotsRatio = totalStakesSnapshot
        .mul(toBN(dec(1, 18)))
        .div(totalCollateralSnapshot)
      
      console.log(`step: ${step}`)
      console.log(`Snapshots ratio: ${makeDecimal(snapshotsRatio, 18)}`)

      const stepData = [step, snapshotsRatio, "\n"]
      data.push(`Fraction of total coll liquidated at each step: ${percentLiquidated}%`, "\n")
      data.push(stepData)

      if (snapshotsRatio.lt(toBN(100))) {
        console.log("stop: snapshotsRatio became tiny")
        break
      }

      step += 1 
    }

    fs.writeFile('stakeModel/outputs/snapshotsRatioData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("Snapshots ratio data written to stakeModel/outputs/snapshotsRatioData.csv")
      }
    })
  })
})
   
