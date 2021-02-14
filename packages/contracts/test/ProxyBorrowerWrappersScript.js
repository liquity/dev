const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const TroveManagerTester = artifacts.require("TroveManagerTester")
const LQTYTokenTester = artifacts.require("LQTYTokenTester")

const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const LQTYStakingScript = artifacts.require('LQTYStakingScript')

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  LQTYStakingProxy
} = require('../utils/proxyHelpers.js')

contract('BorrowerWrappers', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    defaulter_1, defaulter_2,
    // frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let troveManagerOriginal
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let borrowerWrappers
  let lqtyTokenTester
  let lqtyToken
  let lqtyStaking

  let contracts

  let LUSD_GAS_COMPENSATION

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployLUSDToken(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress)

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyTokenTester = LQTYContracts.lqtyToken

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    LUSD_GAS_COMPENSATION = await borrowerOperations.LUSD_GAS_COMPENSATION()

    const users = [ alice, bob, carol, dennis, whale, A, B, C, D, E, defaulter_1, defaulter_2 ]
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      borrowerOperations.address,
      troveManager.address,
      stabilityPool.address,
      priceFeed.address,
      lusdToken.address,
      lqtyTokenTester.address,
      lqtyStaking.address
    )
    borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address, borrowerWrappers)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(borrowerOperations.address)
    borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, borrowerOperations)

    troveManagerOriginal = troveManager
    const troveManagerScript = await TroveManagerScript.new(troveManager.address)
    troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, troveManager)
    contracts.troveManager = troveManager

    const stabilityPoolScript = await StabilityPoolScript.new(stabilityPool.address)
    stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, stabilityPool)
    contracts.stabilityPool = stabilityPool

    sortedTroves = new SortedTrovesProxy(owner, proxies, sortedTroves)

    const lusdTokenScript = await TokenScript.new(lusdToken.address)
    lusdToken = new TokenProxy(owner, proxies, lusdTokenScript.address, lusdToken)

    const lqtyTokenScript = await TokenScript.new(lqtyTokenTester.address)
    lqtyToken = new TokenProxy(owner, proxies, lqtyTokenScript.address, lqtyTokenTester)

    const lqtyStakingScript = await LQTYStakingScript.new(lqtyStaking.address)
    lqtyStaking = new LQTYStakingProxy(owner, proxies, lqtyStakingScript.address, lqtyStaking)
  })

  // --- claimCollateralAndOpenTrove ---

  it('claimCollateralAndOpenTrove():', async () => {
  })

  // --- claimSPRewardsAndLoop ---

  it('claimSPRewardsAndLoop(): only owner can call it', async () => {
    // Whale deposits 1850 LUSD in StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(1850, 18), whale, whale, { from: whale, value: dec(50, 'ether') })
    await stabilityPool.provideToSP(dec(1850, 18), ZERO_ADDRESS, { from: whale })

    // alice opens trove and provides 150 LUSD to StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(150, 18), alice, alice, { from: alice, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // Defaulter Trove opened, 170 LUSD debt
    await borrowerOperations.openTrove(th._100pct, 0, defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(th._100pct, await getOpenTroveLUSDAmount(dec(170, 18)), defaulter_1, defaulter_1, { from: defaulter_1 })

    // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // User with Trove with 170 LUSD drawn are closed
    const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })  // 170 LUSD closed
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Bob tries to claims SP rewards in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimSPRewardsAndLoop(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.executeTarget(borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimSPRewardsAndLoop():', async () => {
    // Whale deposits 1850 LUSD in StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(1850, 18), whale, whale, { from: whale, value: dec(50, 'ether') })
    await stabilityPool.provideToSP(dec(1850, 18), ZERO_ADDRESS, { from: whale })

    // alice opens trove and provides 150 LUSD to StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(150, 18), alice, alice, { from: alice, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // Defaulter Trove opened, 170 LUSD debt
    await borrowerOperations.openTrove(th._100pct, 0, defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(th._100pct, await getOpenTroveLUSDAmount(dec(170, 18)), defaulter_1, defaulter_1, { from: defaulter_1 })

    // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // User with Trove with 170 LUSD drawn are closed
    const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })  // 170 LUSD closed
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Alice LUSDLoss is ((150/2000) * liquidatedDebt)
    const expectedLUSDLoss_A = (liquidatedDebt_1.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))))

    const expectedCompoundedLUSDDeposit_A = toBN(dec(150, 18)).sub(expectedLUSDLoss_A)
    const compoundedLUSDDeposit_A = await stabilityPool.getCompoundedLUSDDeposit(alice)
    // 1 * 150 / 2000 * 0.995
    const expectedETHGain_A = toBN(dec(74625, 12))

    assert.isAtMost(th.getDifference(expectedCompoundedLUSDDeposit_A, compoundedLUSDDeposit_A), 1000)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const lusdBalanceBefore = await lusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const lqtyBalanceBefore = await lqtyToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await lqtyStaking.stakes(alice)

    const proportionalLUSD = expectedETHGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalLUSD.mul(mv._1e18BN).div(mv._1e18BN.add(borrowingRate))

    // to force LQTY issuance
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const expectedLQTYGain_A = toBN('62966780249258131199914')

    // Alice claims SP rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimSPRewardsAndLoop(th._100pct, alice, alice, { from: alice })

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const lusdBalanceAfter = await lusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const lqtyBalanceAfter = await lqtyToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await lqtyStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(lusdBalanceAfter.toString(), lusdBalanceBefore.toString())
    assert.equal(lqtyBalanceAfter.toString(), lqtyBalanceBefore.toString())
    // check trove has increased debt by the ICR proportional amount to ETH gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalLUSD))
    // check trove has increased collateral by the ETH gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedETHGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.sub(expectedLUSDLoss_A).add(netDebtChange))
    // check lqty balance remains the same
    th.assertIsApproximatelyEqual(lqtyBalanceAfter, lqtyBalanceBefore)

    // LQTY staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedLQTYGain_A))

    // Expect Alice has withdrawn all ETH gain
    const alice_pendingETHGain = await stabilityPool.getDepositorETHGain(alice)
    assert.equal(alice_pendingETHGain, 0)
  })


  // --- claimStakingGainsAndLoop ---

  it('claimStakingGainsAndLoop(): only owner can call it', async () => {
    // Whale deposits 1850 LUSD in StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(1850, 18), whale, whale, { from: whale, value: dec(50, 'ether') })

    // alice opens trove and provides 150 LUSD to StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(150, 18), alice, alice, { from: alice, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some LQTY
    await lqtyTokenTester.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await lqtyTokenTester.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake LQTY
    await lqtyStaking.stake(dec(1850, 18), { from: whale })
    await lqtyStaking.stake(dec(150, 18), { from: alice })

    const totalDebt = toBN(dec(170, 18))
    const netDebt = await getOpenTroveLUSDAmount(totalDebt)

    // Defaulter Trove opened, 170 LUSD debt
    await borrowerOperations.openTrove(th._100pct, netDebt, defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 LUSD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Bob tries to claims staking gains in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimStakingGainsAndLoop(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.executeTarget(borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimStakingGainsAndLoop(): reverts if user has no trove', async () => {
  })

  it('claimStakingGainsAndLoop(): with only ETH gain', async () => {
  })

  it('claimStakingGainsAndLoop(): with only LUSD gain', async () => {
  })

  it('claimStakingGainsAndLoop(): with both ETH and LUSD gains', async () => {
    const price = toBN(dec(200, 18))

    // Whale deposits 1850 LUSD in StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(1850, 18), whale, whale, { from: whale, value: dec(50, 'ether') })

    // alice opens trove and provides 150 LUSD to StabilityPool
    await borrowerOperations.openTrove(th._100pct, dec(150, 18), alice, alice, { from: alice, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some LQTY
    await lqtyTokenTester.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await lqtyTokenTester.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake LQTY
    await lqtyStaking.stake(dec(1850, 18), { from: whale })
    await lqtyStaking.stake(dec(150, 18), { from: alice })

    const totalDebt = toBN(dec(170, 18))
    const netDebt = await getOpenTroveLUSDAmount(totalDebt)
    const actualDebt = await getActualDebtFromComposite(totalDebt)
    const borrowingFee = actualDebt.sub(netDebt)

    // Defaulter Trove opened, 170 LUSD debt
    await borrowerOperations.openTrove(th._100pct, netDebt, defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // Alice LUSD gain is ((150/2000) * borrowingFee)
    const expectedLUSDGain_A = borrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 LUSD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Alice ETH gain is ((150/2000) * (redemption fee over redeemedAmount) / price)
    const redemptionFee = await troveManager.getRedemptionFeeWithDecay(redeemedAmount)
    const expectedETHGain_A = redemptionFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))).mul(mv._1e18BN).div(price)

    const ethBalanceBefore = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const lusdBalanceBefore = await lusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const lqtyBalanceBefore = await lqtyToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await lqtyStaking.stakes(alice)

    const proportionalLUSD = expectedETHGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalLUSD.mul(toBN(dec(1, 18))).div(toBN(dec(1, 18)).add(borrowingRate))
    const expectedTotalLUSD = expectedLUSDGain_A.add(netDebtChange)

    const expectedLQTYGain_A = toBN('839557069990108416000000')

    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndLoop(th._100pct, alice, alice, { from: alice })

    // Alice new LUSD gain due to her own Trove adjustment: ((150/2000) * (borrowing fee over netDebtChange))
    const newBorrowingFee = await troveManagerOriginal.getBorrowingFeeWithDecay(netDebtChange)
    const expectedNewLUSDGain_A = newBorrowingFee.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const ethBalanceAfter = await web3.eth.getBalance(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const lusdBalanceAfter = await lusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const lqtyBalanceAfter = await lqtyToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await lqtyStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
    assert.equal(lqtyBalanceAfter.toString(), lqtyBalanceBefore.toString())
    // check proxy lusd balance has increased by own adust trove reward
    th.assertIsApproximatelyEqual(lusdBalanceAfter, lusdBalanceBefore.add(expectedNewLUSDGain_A))
    // check trove has increased debt by the ICR proportional amount to ETH gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalLUSD), 10000)
    // check trove has increased collateral by the ETH gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedETHGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(expectedTotalLUSD), 10000)
    // check lqty balance remains the same
    th.assertIsApproximatelyEqual(lqtyBalanceBefore, lqtyBalanceAfter)

    // LQTY staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedLQTYGain_A))

    // Expect Alice has withdrawn all ETH gain
    const alice_pendingETHGain = await stabilityPool.getDepositorETHGain(alice)
    assert.equal(alice_pendingETHGain, 0)
  })

})
