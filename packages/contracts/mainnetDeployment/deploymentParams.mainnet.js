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
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd", // TODO - 
  LQTY_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74", // TODO - 
  DEPLOYER: "0xF8e5C47a6866e97F5D561982Ff80D39c436E573E" // Mainnet TEST deployment address
}

const beneficiaries = {
  ACCOUNT_2: "0x4BDe43C7F3CCdB060bc93f36bc5B0c44884fe46c",  
  ACCOUNT_3: "0x7AdD52BEC7d7D7120F7E8a6DE19112d7fcC1FD6F",
}

const OUTPUT_FILE = './mainnetDeployment/mainnetDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}

const GAS_PRICE = 130000000000
const TX_CONFIRMATIONS = 3 // for mainnet

const ETHERSCAN_BASE_URL = 'https://etherscan.io/address'

module.exports = {
  externalAddrs,
  liquityAddrs,
  beneficiaries,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  // ETHERSCAN_BASE_URL,
};
