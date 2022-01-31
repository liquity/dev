import { WalletConnectConnector } from '@web3-react/walletconnect-connector'

const BP_API = "https://eth-node.b-protocol.workers.dev"
const KOVAN_BP_API = "https://kovan-node.b-protocol.workers.dev"

const POLLING_INTERVAL = 12000

const RPC_URLS: { [chainId: number]: string } = {
  1: BP_API,
  42: KOVAN_BP_API
}

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