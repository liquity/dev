import { WalletLinkConnector } from '@web3-react/walletlink-connector';
import { RPC_URLS } from '.';

export const coinbaseWalletConnector = new WalletLinkConnector({
    url: RPC_URLS[1],
    appName: 'Backstop Protocol',
    supportedChainIds: [1, 3, 4, 5, 42, 10, 137, 69, 420, 80001]
});