const { secrets } = require("../secrets.js");
const { UniswapV2Factory } = require("./ABIs/UniswapFactoryABI.js")
const { ERC20Abi } = require("./ABIs/ERC20.js")
const mdh = require("../utils/mainnetDeploymentHelpers.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { externalAddrs, liquityAddrs, beneficiaries } = require("./mainnetAddresses.js")

const readline = require("readline");

const output = {}

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

    const latestBlock = await ethers.provider.getBlockNumber()
    const now = (await ethers.provider.getBlock(latestBlock)).timestamp 

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
    console.log(`General Safe balance: ${communityIssuanceBal}`)

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
   
    // TODO: Check Uniswap pool has LUSD and ETH

    // --- TODO: Check LP staking is working ---
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });