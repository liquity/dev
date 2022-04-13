//import { InjectedConnector } from './Injected'
import { InjectedConnector } from '@web3-react/injected-connector'
import { NetworkConnector } from './Network'

const POLLING_INTERVAL = 10000

export const injected = new InjectedConnector({
  supportedChainIds: [17]
})

export const network = new NetworkConnector({
  urls: { 444900: "https://rpc1.bakerloo.autonity.network:8545"  }, //TODO: Use a env variable
  pollingInterval: POLLING_INTERVAL
})
