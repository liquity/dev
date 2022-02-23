const IsMainnet = false;

const externalAddrs = {
  CHAINLINK_ETHUSD_PROXY: "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8",
  CHAINLINK_BTCUSD_PROXY: "0x0c9973e7a27d00e656B9f153348dA46CaD70d03d",
  CHAINLINK_OHM_PROXY: "0x52C9Eb2Cc68555357221CAe1e5f2dD956bC194E5",  // USE LINK-USD for now
  CHAINLINK_OHM_INDEX_PROXY: "N/A",
  CHAINLINK_FLAG_HEALTH: "0x491B1dDA0A8fa069bbC1125133A975BF4e85a91b",

  WETH_ERC20: "0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681",
  REN_BTC: "NONE",
  GOHM: "NONE",
}

const vestaAddresses = {
  ADMIN_MULTI: "0x03859cff40DcC115D5DF6225E8167d5955E68FF1",
  VSTA_SAFE: "0x03859cff40DcC115D5DF6225E8167d5955E68FF1", // TODO
  DEPLOYER: "0x03859cff40DcC115D5DF6225E8167d5955E68FF1",
}

const beneficiaries = {
  "0x473fD837E0fFcc46CfFbf89B62aab6Fe65D4E992": 50,
  "0x15aD39c4e5aFF2D6aD278b3d335F48FDfB91e6FB": 50
}

const REDEMPTION_SAFETY = 0;

const OUTPUT_FILE = './mainnetDeployment/localForkDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}


const GAS_PRICE = 20000000000
const TX_CONFIRMATIONS = 1 // for local fork test

module.exports = {
  externalAddrs,
  vestaAddresses,
  beneficiaries,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  REDEMPTION_SAFETY,
  IsMainnet
};
