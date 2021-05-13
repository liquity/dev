import { WalletLinkConnector } from "@web3-react/walletlink-connector";

const APP_NAME = "Liquity Land";
const ETH_JSONRPC_URL = "https://mainnet.infura.io/v3/864d7f4fb6b447eead8028f0134d1241";

export const walletLinkConnector = new WalletLinkConnector({
  appName: APP_NAME,
  url: ETH_JSONRPC_URL
});
