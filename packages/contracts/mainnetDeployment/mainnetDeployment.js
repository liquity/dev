const fs = require('fs')
const { UniswapV2Factory } = require("./ABIs/UniswapFactoryABI.js")
const { ERC20Abi } = require("./ABIs/ERC20.js")
const mdh = require("../utils/mainnetDeploymentHelpers.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { externalAddrs, liquityAddrs, beneficiaries } = require("./mainnetAddresses.js")

const OUTPUT_FILE = './output/mainnetDeploymentOutput'

const loadPreviousDeployment = () => {
    let previousDeployment = {}
    if (fs.existsSync(OUTPUT_FILE)) {
        console.log(`Loading previous deployment...`)
        previousDeployment = require(OUTPUT_FILE)
    }

    return previousDeployment
}

async function mainnetDeploy(mainnetProvider, deployerWallet, liquityAddrs) {
    const deploymentState = loadPreviousDeployment()

    console.log(`deployer address: ${deployerWallet.address}`)
    assert.equal(deployerWallet.address, liquityAddrs.DEPLOYER)
    let deployerETHBalance = await mainnetProvider.getBalance(deployerWallet.address)
    console.log(`deployerETHBalance before: ${deployerETHBalance}`)

    // Get UniswaV2Factory instance at its deployed address
    const uniswapV2Factory =  new ethers.Contract(
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
    const liquityCore = await mdh.deployLiquityCoreMainnet(deployerWallet, externalAddrs.TELLOR_MASTER)
    await mdh.logContractObjects(liquityCore)

    // Check Uniswap Pair LUSD-ETH pair before pair creation
    let LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
    let WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
    assert.equal(LUSDWETHPairAddr, th.ZERO_ADDRESS)
    assert.equal(WETHLUSDPairAddr, th.ZERO_ADDRESS)

    // Deploy Unipool for LUSD-WETH
    const tx = await uniswapV2Factory.createPair(
      externalAddrs.WETH_ERC20, 
      liquityCore.lusdToken.address
    )

    // Check Uniswap Pair LUSD-WETH pair after pair creation (forwards and backwards should have same address)
    LUSDWETHPairAddr = await uniswapV2Factory.getPair(liquityCore.lusdToken.address, externalAddrs.WETH_ERC20)
    WETHLUSDPairAddr = await uniswapV2Factory.getPair(externalAddrs.WETH_ERC20, liquityCore.lusdToken.address)
    console.log(`LUSD-WETH pair contract address after Uniswap pair creation: ${LUSDWETHPairAddr}`)
    assert.equal(WETHLUSDPairAddr, LUSDWETHPairAddr)

    // Deploy Unipool
    const unipool = await mdh.deployUnipoolMainnet()

    const LQTYContracts = await mdh.deployLQTYContractsMainnet(
      liquityAddrs.GENERAL_SAFE,
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

    const latestBlock = await mainnetProvider.getBlockNumber()
    const now = (await mainnetProvider.getBlock(latestBlock)).timestamp 

    console.log(`time now: ${now}`)
    const oneYearFromNow = (now + timeVals.SECONDS_IN_ONE_YEAR).toString()
    console.log(`time oneYearFromNow: ${oneYearFromNow}`)

    // Deploy LockupContracts - one for each beneficiary
    const lockupContracts = {}

    for (const [investor, investorAddr] of Object.entries(beneficiaries)) {
      const txResponse = await LQTYContracts.lockupContractFactory.deployLockupContract(investorAddr, oneYearFromNow)
      const txReceipt = await mainnetProvider.getTransactionReceipt(txResponse.hash)
     
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
    assert.equal(unipoolLQTYBal.toString(), '1333333333333333333333333')
    th.logBN('Unipool LQTY balance       ', unipoolLQTYBal)

    // Deployer
    const lqtyDeployerBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.LQTY_SAFE)
    assert.equal(lqtyDeployerBal.toString(), '65666666666666666666666667')
    th.logBN('LQTY Deployer balance     ', lqtyDeployerBal)

    // Bounties/hackathons
    const generalSafeBal = await LQTYContracts.lqtyToken.balanceOf(liquityAddrs.GENERAL_SAFE)
    assert.equal(generalSafeBal.toString(), '1000000000000000000000000')
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
    // const tellorCallerTellorMasterAddress = await liquityCore.tellorCaller.tellor() 
    // assert.equal(tellorCallerTellorMasterAddress, externalAddrs.TELLOR_MASTER)

    // --- Unipool ---

    // Check Unipool's LUSD-ETH Uniswap Pair address
    const unipoolUniswapPairAddr = await unipool.uniToken()
    console.log(`Unipool's stored LUSD-ETH Uniswap Pair address: ${unipoolUniswapPairAddr}`)

    // --- Sorted Troves ---

    // Check max size
    const sortedTrovesMaxSize = (await liquityCore.sortedTroves.data())[2]
    assert.equal(sortedTrovesMaxSize, '115792089237316195423570985008687907853269984665640564039457584007913129639935')

    // TODO: Make first LUSD-ETH liquidity provision 
   
    // TODO: Check Uniswap pool has LUSD and ETH

    // --- TODO: Check LP staking is working ---
}

module.exports = {
    mainnetDeploy
}
