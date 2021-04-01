
const { UniswapV2Factory } = require("./ABIs/UniswapV2Factory.js")
const { UniswapV2Pair } = require("./ABIs/UniswapV2Pair.js")
const { UniswapV2Router02 } = require("./ABIs/UniswapV2Router02.js")
const { ChainlinkAggregatorV3Interface } = require("./ABIs/ChainlinkAggregatorV3Interface.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { externalAddrs, beneficiaries } = require("./mainnetAddresses.js")
const { dec } = th
const mdh = require("../utils/mainnetDeploymentHelpers.js")

const toBigNum = ethers.BigNumber.from
const delay = ms => new Promise(res => setTimeout(res, ms));
const GAS_PRICE = 220000000000

async function mainnetDeploy(mainnetProvider, deployerWallet, liquityAddrs) {
  const deploymentState = mdh.loadPreviousDeployment()

  console.log(`deployer address: ${deployerWallet.address}`)
  assert.equal(deployerWallet.address, liquityAddrs.DEPLOYER)
  let deployerETHBalance = await mainnetProvider.getBalance(deployerWallet.address)
  console.log(`deployerETHBalance before: ${deployerETHBalance}`)

  // Get UniswaV2Factory instance at its deployed address
  const uniswapV2Factory = new ethers.Contract(
    externalAddrs.UNISWAP_V2_FACTORY,
    UniswapV2Factory.abi,
    deployerWallet
  );

  console.log(`Uniswp addr: ${uniswapV2Factory.address}`)
  const uniAllPairsLength = await uniswapV2Factory.allPairsLength()
  console.log(`Uniswap Factory number of pairs: ${uniAllPairsLength}`)

  deployerETHBalance = await mainnetProvider.getBalance(deployerWallet.address)
  console.log(`deployer's ETH balance before deployments: ${deployerETHBalance}`)

  // Deploy core logic contracts
  const liquityCore = await mdh.deployLiquityCoreMainnet(deployerWallet, externalAddrs.TELLOR_MASTER, deploymentState, GAS_PRICE)
  await mdh.logContractObjects(liquityCore)

  // Check Uniswap Pair LUSD-ETH pair before pair creation
  let LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
  let WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
  assert.equal(LUSDWETHPairAddr, WETHLUSDPairAddr)


  if (LUSDWETHPairAddr == th.ZERO_ADDRESS) {
    // Deploy Unipool for LUSD-WETH
    const tx = await uniswapV2Factory.createPair(
      externalAddrs.WETH_ERC20,
      liquityCore.lusdToken.address,
      {gasPrice: GAS_PRICE}
    )
    await mainnetProvider.waitForTransaction(tx.hash)

    // Check Uniswap Pair LUSD-WETH pair after pair creation (forwards and backwards should have same address)
    LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
    assert.notEqual(LUSDWETHPairAddr, th.ZERO_ADDRESS)
    WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
    console.log(`LUSD-WETH pair contract address after Uniswap pair creation: ${LUSDWETHPairAddr}`)
    assert.equal(WETHLUSDPairAddr, LUSDWETHPairAddr)
  }

  // Deploy Unipool
  const unipool = await mdh.deployUnipoolMainnet(deployerWallet, deploymentState, GAS_PRICE)

  // Deploy LQTY Contracts
  const LQTYContracts = await mdh.deployLQTYContractsMainnet(
    liquityAddrs.GENERAL_SAFE,
    unipool.address,
    liquityAddrs.LQTY_SAFE,
    deployerWallet,
    deploymentState,
    GAS_PRICE
  )

  await mdh.connectCoreContractsMainnet(liquityCore, LQTYContracts, externalAddrs.CHAINLINK_ETHUSD_PROXY, mainnetProvider, GAS_PRICE)
  await mdh.connectLQTYContractsMainnet(LQTYContracts, mainnetProvider, GAS_PRICE)
  await mdh.connectLQTYContractsToCoreMainnet(LQTYContracts, liquityCore, mainnetProvider, GAS_PRICE)

  // Connect Unipool to LQTYToken and the LUSD-WETH pair address, with a 6 week duration
  const LPRewardsDuration = timeVals.SECONDS_IN_SIX_WEEKS
  await mdh.connectUnipoolMainnet(unipool, LQTYContracts, LUSDWETHPairAddr, LPRewardsDuration, mainnetProvider, GAS_PRICE)

  // Log LQTY and Unipool addresses
  await mdh.logContractObjects(LQTYContracts)
  console.log(`Unipool address: ${unipool.address}`)

  let latestBlock = await mainnetProvider.getBlockNumber()
  let now = (await mainnetProvider.getBlock(latestBlock)).timestamp

  console.log(`time now: ${now}`)
  const oneYearFromNow = (now + timeVals.SECONDS_IN_ONE_YEAR).toString()
  console.log(`time oneYearFromNow: ${oneYearFromNow}`)

  // Deploy LockupContracts - one for each beneficiary
  const lockupContracts = {}

  for (const [investor, investorAddr] of Object.entries(beneficiaries)) {
    if (deploymentState[investor] && deploymentState[investor].address) {
      console.log(`Using previously deployed ${investor} lockup contract at address ${deploymentState[investor].address}`)
      lockupContracts[investor] = await th.getLCFromAddress(deploymentState[investor].address)
    } else {
      const txReceipt = await mdh.sendAndWaitForTransaction(mainnetProvider, LQTYContracts.lockupContractFactory.deployLockupContract(investorAddr, oneYearFromNow, {gasPrice: GAS_PRICE}))

      const address = await txReceipt.logs[0].address // The deployment event emitted from the LC itself is is the first of two events, so this is its address 
      lockupContracts[investor] = await th.getLCFromAddress(address)

      deploymentState[investor] = {
        address: address,
        txHash: txReceipt.transactionHash
      }

      mdh.saveDeployment(deploymentState)

    }
  }

  // // --- TESTS AND CHECKS  ---

  // Check chainlink proxy price ---

  const chainlinkProxy = new ethers.Contract(
    externalAddrs.CHAINLINK_ETHUSD_PROXY,
    ChainlinkAggregatorV3Interface,
    deployerWallet
  )

  // Get latest price
  const price = await chainlinkProxy.latestAnswer()
  console.log(`current Chainlink price: ${price}`)

  // TODO: Check Tellor price directly

  // --- Lockup Contracts ---

  // Check lockup contracts exist for each beneficiary with correct unlock time
  for (investor of Object.keys(lockupContracts)) {
    const lockupContract = lockupContracts[investor]
    const onChainBeneficiary = await lockupContract.beneficiary()
    const unlockTime = await lockupContract.unlockTime()

    console.log(
      `lockupContract addr: ${th.squeezeAddr(lockupContract.address)},
          beneficiary: ${investor},
          beneficiary addr: ${th.squeezeAddr(beneficiaries[investor])},
          on-chain beneficiary addr: ${th.squeezeAddr(onChainBeneficiary)}
          unlockTime: ${unlockTime}
          `
    )
  }
  // --- LQTY allowances of different addresses ---

  // Unipool
  const unipoolLQTYBal = await LQTYContracts.lqtyToken.balanceOf(unipool.address)
  assert.equal(unipoolLQTYBal.toString(), '1333333333333333333333333')
  th.logBN('Unipool LQTY balance       ', unipoolLQTYBal)

  // LQTY Safe
  const lqtyDeployerBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.LQTY_SAFE)
  assert.equal(lqtyDeployerBal.toString(), '64666666666666666666666667')
  th.logBN('LQTY Deployer balance     ', lqtyDeployerBal)

  // Bounties/hackathons (General Safe)
  const generalSafeBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.GENERAL_SAFE)
  assert.equal(generalSafeBal.toString(), '2000000000000000000000000')
  th.logBN('General Safe balance       ', generalSafeBal)

  // CommunityIssuance contract
  const communityIssuanceBal = await LQTYContracts.lqtyToken.balanceOf(LQTYContracts.communityIssuance.address)
  assert.equal(communityIssuanceBal.toString(), '32000000000000000000000000')
  th.logBN('Community Issuance balance', communityIssuanceBal)

  // --- PriceFeed ---

  // Check Pricefeed's status and last good price
  const lastGoodPrice = await liquityCore.priceFeed.lastGoodPrice()
  const priceFeedInitialStatus = await liquityCore.priceFeed.status()
  th.logBN('PriceFeed first stored price', lastGoodPrice)
  console.log(`PriceFeed initial status: ${priceFeedInitialStatus}`)

  // Check PriceFeed's & TellorCaller's stored addresses

  const priceFeedCLAddress = await liquityCore.priceFeed.priceAggregator()
  const priceFeedTellorCallerAddress = await liquityCore.priceFeed.tellorCaller()
  assert.equal(priceFeedCLAddress, externalAddrs.CHAINLINK_ETHUSD_PROXY)
  assert.equal(priceFeedTellorCallerAddress, '0x7a3d735ee6873f17Dbdcab1d51B604928dc10d92')

  // TODO:  Make tellor public in TellorCaller
  const tellorCallerTellorMasterAddress = await liquityCore.tellorCaller.tellor() 
  assert.equal(tellorCallerTellorMasterAddress, externalAddrs.TELLOR_MASTER)

  // --- Unipool ---

  // Check Unipool's LUSD-ETH Uniswap Pair address
  const unipoolUniswapPairAddr = await unipool.uniToken()
  console.log(`Unipool's stored LUSD-ETH Uniswap Pair address: ${unipoolUniswapPairAddr}`)

  // --- Sorted Troves ---

  // Check max size
  const sortedTrovesMaxSize = (await liquityCore.sortedTroves.data())[2]
  assert.equal(sortedTrovesMaxSize, '115792089237316195423570985008687907853269984665640564039457584007913129639935')

  // --- TroveManager ---

  const liqReserve = await liquityCore.troveManager.LUSD_GAS_COMPENSATION()
  const minNetDebt = await liquityCore.troveManager.MIN_NET_DEBT()

  console.log(`system liquidation reserve: ${liqReserve}`)
  console.log(`system min net debt: ${minNetDebt}`)

  // --- Make first LUSD-ETH liquidity provision ---

  // Open trove
  let _3kLUSDWithdrawal = th.dec(3000, 18) // 3000 LUSD
  let _3ETHcoll = th.dec(3, 'ether') // 3 ETH
  const openTroveTx = await liquityCore.borrowerOperations.openTrove(th._100pct, _3kLUSDWithdrawal, th.ZERO_ADDRESS, th.ZERO_ADDRESS, { value: _3ETHcoll, gasPrice: GAS_PRICE })
  await mainnetProvider.waitForTransaction(openTroveTx.hash)

  // Check deployer now has an open trove
  console.log(`deployer is in sorted list after making trove: ${await liquityCore.sortedTroves.contains(deployerWallet.address)}`)

  const deployerTrove = await liquityCore.troveManager.Troves(deployerWallet.address)
  console.log(`deployer debt: ${deployerTrove[0]}`)
  console.log(`deployer coll: ${deployerTrove[1]}`)
  console.log(`deployer stake: ${deployerTrove[2]}`)
  console.log(`deployer status: ${deployerTrove[3]}`)

  // Check deployer has LUSD
  const deployerLUSDBal = await liquityCore.lusdToken.balanceOf(deployerWallet.address)
  console.log(`deployer's LUSD balance: ${deployerLUSDBal}`)

  // TODO: Check Uniswap pool has 0 LUSD and ETH reserves
  const LUSDETHPair = await new ethers.Contract(
    LUSDWETHPairAddr,
    UniswapV2Pair.abi,
    deployerWallet
  )

  const token0Addr = await LUSDETHPair.token0()
  const token1Addr = await LUSDETHPair.token1()
  console.log(`LUSD-ETH Pair token 0: ${th.squeezeAddr(token0Addr)},
      LUSDToken contract addr: ${th.squeezeAddr(liquityCore.lusdToken.address)}`)
  console.log(`LUSD-ETH Pair token 1: ${th.squeezeAddr(token1Addr)},
      WETH ERC20 contract addr: ${th.squeezeAddr(externalAddrs.WETH_ERC20)}`)

  // Check initial LUSD-ETH pair reserves before provision
  let reserves = await LUSDETHPair.getReserves()
  console.log(`LUSD-ETH Pair's LUSD reserves before provision:${reserves[0]}`)
  console.log(`LUSD-ETH Pair's ETH reserves before provision:${reserves[1]}`)

  // Get the UniswapV2Router contract
  const uniswapV2Router02 = new ethers.Contract(
    externalAddrs.UNIWAP_V2_ROUTER02,
    UniswapV2Router02.abi,
    deployerWallet
  )

  // Give router an allowance for LUSD
  await liquityCore.lusdToken.increaseAllowance(uniswapV2Router02.address, dec(10000, 18))

  // Check Router's spending allowance
  const routerLUSDAllowanceFromDeployer = await liquityCore.lusdToken.allowance(deployerWallet.address, uniswapV2Router02.address)
  console.log(`router's spending allowance for deployer's LUSD: ${routerLUSDAllowanceFromDeployer}`)

  // Get amounts for liquidity provision
  const LP_ETH = dec(1, 'ether')

  // Convert 8-digit CL price to 18 and multiply by ETH amount
  const LUSDAmount = toBigNum(price)
    .mul(toBigNum(dec(1, 10)))
    .mul(toBigNum(LP_ETH))
    .div(toBigNum(dec(1, 18)))

  const minLUSDAmount = LUSDAmount.sub(toBigNum(dec(100, 18)))

  latestBlock = await ethers.provider.getBlockNumber()
  now = (await ethers.provider.getBlock(latestBlock)).timestamp
  let tenMinsFromNow = now + (60 * 60 * 10)

  // Provide liquidity to LUSD-ETH pair
  const provideLiquidityTx = await uniswapV2Router02.addLiquidityETH(
    liquityCore.lusdToken.address, // address of LUSD token
    LUSDAmount, // LUSD provision
    minLUSDAmount, // minimum LUSD provision
    LP_ETH, // minimum ETH provision
    deployerWallet.address, // address to send LP tokens to
    tenMinsFromNow, // deadline for this tx
    {
      value: dec(1, 'ether'),
      gasPrice: GAS_PRICE,
      gasLimit: 5000000 // For some reason, ethers can't estimate gas for this tx
    }
  )
  await mainnetProvider.waitForTransaction(provideLiquidityTx.hash)

  // Check LUSD-ETH reserves after liquidity provision:
  reserves = await LUSDETHPair.getReserves()
  console.log(`LUSD-ETH Pair's LUSD reserves after provision:${reserves[0]}`)
  console.log(`LUSD-ETH Pair's ETH reserves after provision:${reserves[1]}`)

  // ---  Check LP staking is working ---

  // Check deployer's LP tokens
  const deployerLPTokenBal = await LUSDETHPair.balanceOf(deployerWallet.address)
  console.log(`deployer's LP token balance: ${deployerLPTokenBal}`)

  // Stake most of deployer's LP tokens in Unipool
  // *** This overflows?  Should be able to stake

  console.log(`LUSDETHPair addr: ${LUSDETHPair.address}`)
  console.log(`Pair addr stored in Unipool: ${await unipool.uniToken()}`)

  // Deployer approves Unipool
  const approveUnipoolTx = await LUSDETHPair.approve(unipool.address, deployerLPTokenBal, {gasPrice: GAS_PRICE})
  await mainnetProvider.waitForTransaction(approveUnipoolTx.hash)

  const stakeTx = await unipool.stake(1, {gasPrice: GAS_PRICE})
  await mainnetProvider.waitForTransaction(stakeTx.hash)

  // Fast forward time 1000s (local mainnet fork only)
  // ethers.provider.send("evm_increaseTime", [1000])
  // ethers.provider.send("evm_mine") 

  const earnedLQTY = await unipool.earned(deployerWallet.address)
  console.log(`deployer's earned LQTY from Unipool after ~1minute: ${earnedLQTY}`)
}

module.exports = {
  mainnetDeploy
}
