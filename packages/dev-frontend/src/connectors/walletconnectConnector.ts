import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { POLLING_INTERVAL, RPC_URLS } from '.';

export const getWcConnector = () => {
  return new WalletConnectConnector({
    rpc: RPC_URLS,
    bridge: 'https://bridge.walletconnect.org',
    qrcode: true,
    pollingInterval: POLLING_INTERVAL
  })
}

export const resetWc = () => {
  window.localStorage.removeItem("walletconnect")
}
