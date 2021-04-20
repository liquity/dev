
const { TestHelper: th } = require("../utils/testHelpers.js")
const dh = require("./deploymentHelpers.js")
const [alice, bob, carol] = await ethers.provider.listAccounts()

async function main() {
  const coreContracts = await dh.deployLiquityCoreHardhat()
  const ARBITRARY_ADDRESS = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" 
  const LQTYContracts = await dh.deployLQTYContractsHardhat(
      ARBITRARY_ADDRESS, 
      ARBITRARY_ADDRESS,
      ARBITRARY_ADDRESS
    )

 const { troveManager, borrowerOperations, hintHelpers, sortedTroves, priceFeedTestnet } = coreContracts

  await dh.connectCoreContracts(coreContracts, LQTYContracts)
  await dh.connectLQTYContracts(LQTYContracts)
  await dh.connectLQTYContractsToCore(LQTYContracts, coreContracts)

  // Examples of off-chain hint calculation for Open Trove

  // Off-chain calculations
  const toWei = web3.utils.toWei
  const toBN = web3.utils.toBN

  const price = toBN(toWei('2500'))
  await priceFeedTestnet.setPrice(price)

  const LUSDAmount = toBN(toWei('2500')) // borrower wants to withdraw 2500 LUSD
  const ETHColl = toBN(toWei('5')) // borrower wants to lock 5 ETH collateral

  // Call deployed TroveManager contract to read the liquidation reserve and latest borrowing fee
  const liquidationReserve = await troveManager.LUSD_GAS_COMPENSATION()
  const expectedFee = await troveManager.getBorrowingFeeWithDecay(LUSDAmount)
  
  // Total debt of the new trove = LUSD amount drawn, plus fee, plus the liquidation reserve
  const expectedDebt = LUSDAmount.add(expectedFee).add(liquidationReserve)

  // Get the nominal NICR of the new trove
  const _1e20 = toBN(toWei('100'))
  const NICR = ETHColl.mul(_1e20).div(expectedDebt)

  // Get an approximate address hint from the deployed HintHelper contract. Use (15 * number of troves) trials 
  // to get an approx. hint that is close to the right position.
  const numTroves = await sortedTroves.getSize()
  const numTrials = numTroves.mul(toBN('15'))
  const { 0: approxHint } = await hintHelpers.getApproxHint(NICR, numTrials, 42)  // random seed of 42

  // Use the approximate hint to get the exact upper and lower hints from the deployed SortedTroves contract
  const { 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(NICR, approxHint, approxHint)

  // Finally, call openTrove with the exact upperHint and lowerHint
  const maxFee = '5'.concat('0'.repeat(16)) // Slippage protection: 5%
  await borrowerOperations.openTrove(maxFee, LUSDAmount, upperHint, lowerHint, { value: ETHColl })

  console.log(await troveManager.getCurrentICR(alice, price))



  // --- adjust trove --- 
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

