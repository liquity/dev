const BP_API = "https://eth-node.b-protocol.workers.dev"
const KOVAN_BP_API = "https://kovan-node.b-protocol.workers.dev"

export const POLLING_INTERVAL = 12000

export const RPC_URLS: { [chainId: number]: string } = {
  1: BP_API,
  42: KOVAN_BP_API
}