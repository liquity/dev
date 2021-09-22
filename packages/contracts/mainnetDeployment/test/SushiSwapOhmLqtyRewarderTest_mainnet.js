// Test with:
// GAS_PRICE=200000000000 BLOCK_NUMBER=13276436 npx hardhat run mainnetDeployment/test/SushiSwapOhmLqtyRewarderTest_mainnet.js --config hardhat.config.mainnet-fork.js

const { TestHelper: th } = require("../../utils/testHelpers.js");
const { dec } = th;
const toBN = ethers.BigNumber.from;

const SushiSwapOhmLqtyRewarder = require('../../artifacts/contracts/LPRewards/SushiSwapOhmLqtyRewarder.sol/SushiSwapOhmLqtyRewarder.json');
const MasterChefV2 = require('../../artifacts/contracts/LPRewards/TestContracts/MasterChefV2.sol/MasterChefV2.json');
const ERC20 = require('../../artifacts/contracts/LPRewards/TestContracts/ERC20Mock.sol/ERC20Mock.json');

const MASTERCHEF_V2_ADDRESS = '0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d';
const MASTERCHEF_V2_OWNER = '0x19B3Eb3Af5D93b77a5619b047De0EED7115A19e7';
const OHM_MULTIPLIER = toBN(dec(1, 16));
const LQTY_MULTIPLIER = toBN(dec(1, 19));
const ALLOC_POINT = 10;
const ACC_SUSHI_PRECISION = toBN(dec(1, 12));
const UNIT = toBN(dec(1, 18));

async function main() {
  // MasterChef owner
  const impersonateAddress = MASTERCHEF_V2_OWNER;
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ impersonateAddress ]
  });
  const deployerWallet = await ethers.provider.getSigner(impersonateAddress);
  const deployerWalletAddress = impersonateAddress;
  console.log('Deployer:  ', deployerWalletAddress);

  // regular user
  const userWallet = (await ethers.getSigners())[0];
  const userWalletAddress = userWallet.address;
  console.log('User:      ', userWalletAddress);


  const masterChef = new ethers.Contract(
    MASTERCHEF_V2_ADDRESS,
    MasterChefV2.abi,
    deployerWallet
  );

  const tokenFactory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployerWallet);
  const lpToken = await tokenFactory.deploy('LP Token', 'LPT', deployerWalletAddress, 0);
  const ohmToken = await tokenFactory.deploy('OHM Token', 'OHM', deployerWalletAddress, 0);
  const lqtyToken = await tokenFactory.deploy('LQTY Token', 'LQTY', deployerWalletAddress, 0);
  console.log('LP token:  ', lpToken.address);
  console.log('OHM:       ', ohmToken.address);
  console.log('LQTY:      ', lqtyToken.address);

  const rewarderFactory = new ethers.ContractFactory(
    SushiSwapOhmLqtyRewarder.abi,
    SushiSwapOhmLqtyRewarder.bytecode,
    deployerWallet
  );
  const rewarder = await rewarderFactory.deploy(
      OHM_MULTIPLIER,
      ohmToken.address,
      LQTY_MULTIPLIER,
      lqtyToken.address,
      masterChef.address
  );
  console.log('Rewarder:  ', rewarder.address);

  // add rewarder
  const poolAddTx = await masterChef.add(ALLOC_POINT, lpToken.address, rewarder.address);
  const poolAddReceipt = await poolAddTx.wait();
  // We need to get the new pool address out of the PoolCreated event
  const events = poolAddReceipt.events.filter((e) => e.event === 'LogPoolAddition');
  const poolId = events[0].args.pid;
  console.log('poolId: ', poolId.toString());

  // mint
  const initialAmount = dec(1, 24); // 1m
  const lpMintTx = await lpToken.mint(userWalletAddress, initialAmount);
  await lpMintTx.wait();
  th.logBN('User LP balance  ', await lpToken.balanceOf(userWalletAddress));

  // fund rewarder
  const ohmMintTx = await ohmToken.mint(rewarder.address, initialAmount);
  await ohmMintTx.wait();
  const lqtyMintTx = await lqtyToken.mint(rewarder.address, initialAmount);
  await lqtyMintTx.wait();
  th.logBN('Rewarder OHM bal ', await ohmToken.balanceOf(rewarder.address));
  th.logBN('Rewarder LQTY bal', await lqtyToken.balanceOf(rewarder.address));

  // approve
  const depositAmount = toBN(dec(10, 18));
  const userLpToken = new ethers.Contract(
    lpToken.address,
    ERC20.abi,
    userWallet
  );
  const approveTx = await userLpToken.approve(masterChef.address, depositAmount);
  await approveTx.wait();
  // deposit
  const userMasterChef = new ethers.Contract(
    MASTERCHEF_V2_ADDRESS,
    MasterChefV2.abi,
    userWallet
  );
  const ohmInitialDeposit = await ohmToken.balanceOf(userWalletAddress);
  const lqtyInitialDeposit = await lqtyToken.balanceOf(userWalletAddress);
  th.logBN('User OHM balance ', await ohmToken.balanceOf(userWalletAddress));
  th.logBN('User LQTY balance', await lqtyToken.balanceOf(userWalletAddress));
  const depositTx = await userMasterChef.deposit(poolId, depositAmount, userWalletAddress);
  const depositReceipt = await depositTx.wait();
  const depositBlockNumber = depositReceipt.blockNumber;
  assert.equal((await ohmToken.balanceOf(userWalletAddress)).toString(), 0);
  assert.equal((await lqtyToken.balanceOf(userWalletAddress)).toString(), 0);

  // fast-forward
  const blocks = 5;
  for (let i = 0; i < blocks; i++) { await ethers.provider.send('evm_mine'); }

  // harvest
  const harvestTx =  await userMasterChef.harvest(poolId, userWalletAddress);
  const harvestReceipt = await harvestTx.wait();
  const harvestBlockNumber = harvestReceipt.blockNumber;
  const poolInfo = await masterChef.poolInfo(poolId);
  th.logBN('Accumulated sushi per share: ', poolInfo.accSushiPerShare);
  const ohmBalance = await ohmToken.balanceOf(userWalletAddress);
  const lqtyBalance = await lqtyToken.balanceOf(userWalletAddress);
  th.logBN('User OHM balance ', ohmBalance);
  th.logBN('User LQTY balance', lqtyBalance);
  const baseAmount = poolInfo.accSushiPerShare.mul(UNIT).div(ACC_SUSHI_PRECISION)
        .mul(depositAmount).div(UNIT);
  //th.logBN('base', baseAmount);
  assert.equal(
    ohmBalance.toString(),
    baseAmount.mul(OHM_MULTIPLIER).div(UNIT).toString(),
    'OHM rewards don’t match'
  );
  assert.equal(
    lqtyBalance.toString(),
    baseAmount.mul(LQTY_MULTIPLIER).div(UNIT).toString(),
    'LQTY rewards don’t match'
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
