import { WalletConnectConnector } from "@web3-react/walletconnect-connector";

export const walletConnectConnector = new WalletConnectConnector({
  rpc: { 1: "https://mainnet.infura.io/v3/864d7f4fb6b447eead8028f0134d1241" },
  qrcode: true
});
