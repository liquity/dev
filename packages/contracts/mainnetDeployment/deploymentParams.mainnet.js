const externalAddrs  = {
  // https://data.chain.link/eth-usd
  CHAINLINK_ETHUSD_PROXY: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", 
  // https://docs.tellor.io/tellor/integration/reference-page
  TELLOR_MASTER:"0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0",
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  UNIWAP_V2_ROUTER02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  // https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
  WETH_ERC20: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
}

const liquityAddrs = {
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd", // TODO
  LQTY_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74", // TODO
  DEPLOYER: "0xF8e5C47a6866e97F5D561982Ff80D39c436E573E" // Mainnet TEST deployment address
}

const beneficiaries = {
  TEST_INVESTOR_A: "0xdad05aa3bd5a4904eb2a9482757be5da8d554b3d",
  TEST_INVESTOR_B: "0x625b473f33b37058bf8b9d4c3d3f9ab5b896996a",
  TEST_INVESTOR_C: "0x9ea530178b9660d0fae34a41a02ec949e209142e",
  TEST_INVESTOR_D: "0xffbb4f4b113b05597298b9d8a7d79e6629e726e8",
  TEST_INVESTOR_E: "0x89ff871dbcd0a456fe92db98d190c38bc10d1cc1"
}

const OUTPUT_FILE = './mainnetDeployment/mainnetDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}

const GAS_PRICE = 220000000000
const TX_CONFIRMATIONS = 3 // for mainnet

module.exports = {
  externalAddrs,
  liquityAddrs,
  beneficiaries,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
};
