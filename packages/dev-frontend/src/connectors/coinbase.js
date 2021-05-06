import WalletLink from "walletlink";

const APP_NAME = "Liquity Land";
const APP_LOGO_URL = `${process.env.PUBLIC_URL}/icons/favicon.png`;
const ETH_JSONRPC_URL = "https://mainnet.infura.io/v3/158b6511a5c74d1ac028a8a2afe8f626";
const CHAIN_ID = 1;

// Initialize WalletLink
export const walletLink = new WalletLink({
  appName: APP_NAME,
  appLogoUrl: APP_LOGO_URL
});

// Initialize a Web3 Provider object
export const walletLinkProvider = walletLink.makeWeb3Provider(ETH_JSONRPC_URL, CHAIN_ID);
