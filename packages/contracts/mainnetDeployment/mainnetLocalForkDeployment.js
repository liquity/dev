const { secrets } = require("../secrets.js");
const CheckContract = artifacts.require("./CheckContract.sol")
const { UniswapV2Factory } = require("./UniswapFactoryABI.js")
const dh = require("../utils/deploymentHelpers.js")
const th = require("../utils/testHelpers.js")

const { externalAddrs, liquityAddrs, beneficiaries } = require("./mainnetAddresses.js")

const logContractObjects = async (contracts) => {
    console.log(`Contract objects addresses:`)
    for ( contractName of Object.keys(contracts)) {
      console.log(`${contractName}: ${contracts[contractName].address}`);
    }
  }

// TODO:
// Transfer ETH to deployer acct
// Check events from created Uniswap pair
// Check depositing liquidity works
// Check lockup contracts work

async function main() {
    const deployerWallet = new ethers.Wallet(secrets.TEST_DEPLOYER_PRIVATEKEY, ethers.provider)
    console.log(`deployer address: ${deployerWallet.address}`)

    // Impersonate the ETH whale, and transfer ETH to the Liquity deployer
    const whale = ethers.provider.getSigner(externalAddrs.ETH_WHALE)
   
    let deployerETHBalance = await ethers.provider.getBalance(deployerWallet)
    console.log(`deployerETHBalance before: ${deployerETHBalance}`)
    
    await whale.sendTransaction({
      to: deployerWallet.address,
      value: utils.parseEther("10.0")
    })

    deployerETHBalance = await ethers.provider.getBalance(deployerWallet)
    console.log(`deployerETHBalance after whale sends ETH: ${deployerETHBalance}`)

    const liquityCore = await dh.deployLiquityCoreHardhat()
    await logContractObjects(liquityCore)

    console.log(`attempted uni address: ${externalAddrs.UNISWAP_V2_FACTORY}`) 
    // console.log(ethers.provider) 
    // Get Uniswap instance at its deployed address
    const uniswapV2Factory =  new ethers.Contract(
      externalAddrs.UNISWAP_V2_FACTORY, 
      UniswapV2Factory.abi, 
      deployerWallet
    );
  
    // Deploy UniPool for LUSD-ETH
    const tx = await uniswapV2Factory.createPair(
      externalAddrs.WETH_ERC20, 
      liquityCore.lusdToken.address
    )

    // console.log("tx")
    console.log(tx)
    // TODO: deploy from (change default wallet / acct?)
    const LQTYContracts = await dh.deployLQTYContractsHardhat(
      liquityAddrs.TEST_DEPLOYER, 
      liquityAddrs.TEST_DEPLOYER
      )
    
    await dh.connectCoreContracts(liquityCore, LQTYContracts)
    await dh.connectLQTYContracts(LQTYContracts)
    await dh.connectLQTYContractsToCore(LQTYContracts, liquityCore)

    await logContractObjects(LQTYContracts)


    // TODO: Check the deployed contracts, by address on the blockchain




// Test deploying a simple contract to mainnet fork

//   const CheckContract = await ethers.getContractFactory("CheckContract");
//   let currentBlockNum;

//   for (let i = 0; i < 10; i ++) {
//     const checkContract = await CheckContract.deploy({gasLimit: 10000000});
//     await checkContract.deployed();
//     currentBlockNum = await ethers.provider.getBlockNumber()

//     console.log(i, checkContract.address)
//     console.log(`current block number: ${currentBlockNum}`)
//   }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });