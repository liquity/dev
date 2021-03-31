const { secrets } = require("../secrets.js");
const { UniswapV2Factory } = require("./ABIs/UniswapV2Factory.js")
const { UniswapV2Pair } = require("./ABIs/UniswapV2Pair.js")
const { UniswapV2Router02 } = require("./ABIs/UniswapV2Router02.js")
const { ChainlinkAggregatorV3Interface } = require("./ABIs/ChainlinkAggregatorV3Interface.js")
const { ERC20Abi } = require("./ABIs/ERC20.js")
const mdh = require("../utils/mainnetDeploymentHelpers.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { externalAddrs, liquityAddrs, beneficiaries } = require("./mainnetAddresses.js")
const { dec } = th

const toBigNum = ethers.BigNumber.from
const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    const deployerWallet = new ethers.Wallet(secrets.TEST_DEPLOYER_PRIVATEKEY, ethers.provider)
    console.log(`deployer address: ${deployerWallet.address}`)
    
    let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
    console.log(`deployerETHBalance before: ${deployerETHBalance}`)
    
    // Get DAI ER20 instance at its deployed address
    const DAI = new ethers.Contract(
      externalAddrs.DAI_ERC20, 
      ERC20Abi, 
      deployerWallet
    );

   // Get UniswaV2Factory instance at its deployed address
    const uniswapV2Factory =  new ethers.Contract(
      externalAddrs.UNISWAP_V2_FACTORY, 
      UniswapV2Factory.abi, 
      deployerWallet
    );

    console.log(`Uniswp addr: ${uniswapV2Factory.address}`)
    const uniAllPairsLength = await uniswapV2Factory.allPairsLength()
    console.log(`Uniswap Factory number of pairs: ${uniAllPairsLength}`)

    // Impersonate the whale (artificially assume control of its pk)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddrs.ETH_WHALE]}
    )
    console.log(`whale address from import: ${externalAddrs.ETH_WHALE}`)

    // Get the ETH whale signer 
    const whale = await ethers.provider.getSigner(externalAddrs.ETH_WHALE)
    console.log(`whale addr : ${await whale.getAddress()}`)
    console.log(`whale ETH balance: ${ await ethers.provider.getBalance(whale.getAddress())}`)

    // Send ETH to the deployer's address
    await whale.sendTransaction({
      to:  deployerWallet.address,
      value: ethers.utils.parseEther("20.0")
    })

    // Stop impersonating whale
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddrs.ETH_WHALE]}
    )

    deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
    console.log(`deployer's ETH balance before deployments: ${deployerETHBalance}`)

    // Deploy core logic contracts
    const liquityCore = await mdh.deployLiquityCoreMainnet(deployerWallet, externalAddrs.TELLOR_MASTER)
    // await mdh.logContractObjects(liquityCore)

    // Check Uniswap Pair LUSD-ETH pair before pair creation
    let LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
    let WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
    console.log(`LUSD-WETH pair contract address before Uniswap pair creation: ${LUSDWETHPairAddr}`)
    console.log(`WETH-LUSD pair contract address before Uniswap pair creation: ${WETHLUSDPairAddr}`)

    // Deploy Unipool for LUSD-WETH
    const tx = await uniswapV2Factory.createPair(
      externalAddrs.WETH_ERC20, 
      liquityCore.lusdToken.address
    )

    // Check Uniswap Pair LUSD-WETH pair after pair creation (forwards and backwards should have same address)
    LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
    WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
    console.log(`LUSD-WETH pair contract address after Uniswap pair creation: ${LUSDWETHPairAddr}`)
    console.log(`WETH-LUSD pair contract address after Uniswap pair creation: ${WETHLUSDPairAddr}`)

    // Deploy Unipool
    const unipool = await mdh.deployUnipoolMainnet()
    console.log(`unipool address: ${unipool.address}`)
  
    const LQTYContracts = await mdh.deployLQTYContractsMainnet(
      liquityAddrs.TEST_GENERAL_SAFE, 
      unipool.address,
      deployerWallet
    )
    
    await mdh.connectCoreContractsMainnet(liquityCore, LQTYContracts, externalAddrs.CHAINLINK_ETHUSD_PROXY)
    await mdh.connectLQTYContractsMainnet(LQTYContracts)
    await mdh.connectLQTYContractsToCoreMainnet(LQTYContracts, liquityCore)

    // Connect Unipool to LQTYToken and the LUSD-WETH pair address, with a 6 week duration
    const LPRewardsDuration = timeVals.SECONDS_IN_SIX_WEEKS
    await mdh.connectUnipoolMainnet(unipool, LQTYContracts, LUSDWETHPairAddr, LPRewardsDuration)
    
    // Log LQTY and Unipool addresses
    await mdh.logContractObjects(LQTYContracts)
    console.log(`Unipool address: ${unipool.address}`)

    let latestBlock = await ethers.provider.getBlockNumber()
    let now = (await ethers.provider.getBlock(latestBlock)).timestamp 

    console.log(`time now: ${now}`)
    const oneYearFromNow = (now + timeVals.SECONDS_IN_ONE_YEAR).toString()
    console.log(`time oneYearFromNow: ${oneYearFromNow}`)

    // Deploy LockupContracts
    const lockupContracts = {}

    for (const [investor, investorAddr] of Object.entries(beneficiaries)) {
      const txResponse = await LQTYContracts.lockupContractFactory.deployLockupContract(investorAddr, oneYearFromNow)
      const txReceipt = await ethers.provider.getTransactionReceipt(txResponse.hash)
     
      const address = await txReceipt.logs[0].address // The deployment event emitted from the LC itself is is the first of two events, so this is its address 
      lockupContracts[investor] = await th.getLCFromAddress(address) 
    }

    // --- TESTS AND CHECKS  (Extract to new file) ---

    // TODO: Check chainlink proxy price directly ---

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
    console.log(`Unipool LQTY balance: ${unipoolLQTYBal}`)

    // Deployer (TODO: replace with multisig)
    const lqtyDeployerBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.TEST_DEPLOYER)
    console.log(`LQTY Deployer balance: ${lqtyDeployerBal}`)

    // Bounties/hackathons
    const generalSafeBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.TEST_DEPLOYER)
    console.log(`General Safe balance: ${generalSafeBal}`)

    // CommunityIssuance contract
    const communityIssuanceBal = await LQTYContracts.lqtyToken.balanceOf(LQTYContracts.communityIssuance.address)
    console.log(`CommunityIssuance balance: ${communityIssuanceBal}`)

    // --- PriceFeed ---

    // Check Pricefeed's status and last good price
    const lastGoodPrice = await liquityCore.priceFeed.lastGoodPrice()
    const priceFeedInitialStatus = await liquityCore.priceFeed.status()
    console.log(`PriceFeed first stored price: ${lastGoodPrice}`)
    console.log(`PriceFeed initial status: ${priceFeedInitialStatus}`)

    // Check PriceFeed's & TellorCaller's stored addresses

    const priceFeedCLAddress = await liquityCore.priceFeed.priceAggregator()
    const priceFeedTellorCallerAddress = await liquityCore.priceFeed.tellorCaller()
    console.log(`PriceFeed's stored Chainlink address: ${priceFeedCLAddress}`)
    console.log(`PriceFeed's stored TellorCaller address: ${priceFeedTellorCallerAddress}`)
    
    // console.log(`TellorCaller's TellorMaster address: ${tellorCallerTellorMasterAddress}`)
    // const tellorCallerTellorMasterAddress = await liquityCore.tellorCaller.tellor() // TODO: Make tellor public in TellorCaller
   
    // --- Unipool ---

    // Check Unipool's LUSD-ETH Uniswap Pair address
    const unipoolUniswapPairAddr = await unipool.uniToken()
    console.log(`Unipool's stored LUSD-ETH Uniswap Pair address: ${unipoolUniswapPairAddr}`)

    // --- Sorted Troves ---

    // Check max size
    const sortedTrovesMaxSize = (await liquityCore.sortedTroves.data())[2]
    console.log(`SortedTroves current max size:  ${sortedTrovesMaxSize}`)

    // TODO: Make first LUSD-ETH liquidity provision 
     // Open trove
     let _3kLUSDWithdrawal = th.dec(3000, 18) // 3000 LUSD
     let _3ETHcoll = th.dec(3, 'ether') // 3 ETH
     await liquityCore.borrowerOperations.openTrove(th._100pct, _3kLUSDWithdrawal, th.ZERO_ADDRESS, th.ZERO_ADDRESS, {value: _3ETHcoll } )
    
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
    const token1Addr =  await LUSDETHPair.token1()
    console.log(`LUSD-ETH Pair token 0: ${th.squeezeAddr(token0Addr)},
    LUSDToken contract addr: ${th.squeezeAddr(liquityCore.lusdToken.address)}`)
    console.log(`LUSD-ETH Pair token 1: ${th.squeezeAddr(token1Addr)},
    LUSDToken contract addr: ${th.squeezeAddr(externalAddrs.WETH_ERC20)}`)
    
    // Check initial LUSD-ETH pair reserves before provision
    let reserves = await LUSDETHPair.getReserves()
    console.log(`LUSD-ETH Pair's LUSD reserves before provision:${reserves[0]}`)
    console.log(`LUSD-ETH Pair's ETH reserves before provision:${reserves[1]}`)

    // Provide Liquidity to the token pair
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

    // Initial liquidity provision: 1 ETH, and equal value of LUSD
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

    // Add liquidity to LUSD-ETH pair
    await uniswapV2Router02.addLiquidityETH(
      liquityCore.lusdToken.address, // address of LUSD token
      LUSDAmount, // LUSD provision
      minLUSDAmount, // minimum LUSD provision
      LP_ETH, // minimum ETH provision
      deployerWallet.address, // address to send LP tokens to
      tenMinsFromNow, // deadline for this tx
      {
        value: dec(1, 'ether'),
        gasLimit: 5000000 // For some reason, ethers can't estimate gas for this tx
      }
    )
    
    // Check LUSD-ETH reserves after liquidity provision:
    reserves = await LUSDETHPair.getReserves()
    console.log(`LUSD-ETH Pair's LUSD reserves after provision:${reserves[0]}`)
    console.log(`LUSD-ETH Pair's ETH reserves after provision:${reserves[1]}`)

    // --- TODO: Check LP staking is working ---

    // Check deployer's LP tokens
    const deployerLPTokenBal = await LUSDETHPair.balanceOf(deployerWallet.address)
    console.log(`deployer's LP token balance: ${deployerLPTokenBal}`)

    // Stake most of deployer's LP tokens in Unipool
    // *** This overflows?  Should be able to stake
    await unipool.stake(1)

    await delay(60000) // wait 1 minute

    const earnedLQTY = await unipool.earned(deployerWallet.address)
    console.log(`deployer's earned LQTY from Unipool after ~1minute: ${earnedLQTY}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });