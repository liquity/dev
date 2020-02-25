import { Web3Provider } from "ethers/providers";
import { useState, useEffect } from "react";
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from "@web3-react/injected-connector";

const injectedConnector = new InjectedConnector({});

/**
 * React hook that tries to activate the InjectedConnector if the app's already authorized in the
 * browser's wallet (in the case of dApp-enabled browsers) or its wallet extension (e.g. MetaMask).
 *
 * Example: user has a browser with the MetaMask extension. MetaMask injects an Ethereum provider
 * into the window object. We check via InjectedConnector if our app is already authorized to use
 * the wallet through this provider, and in that case we try to activate the connector.
 *
 * @returns true when finished trying to activate the InjectedConnector, false otherwise
 */
export function useInjectedConnector() {
  const { activate } = useWeb3React<Web3Provider>();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const tryToActivateIfAuthorized = async () => {
      try {
        if (await injectedConnector.isAuthorized()) {
          await activate(injectedConnector, undefined, true);
        }
      } finally {
        setTried(true);
      }
    };
    tryToActivateIfAuthorized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* only once */]);

  return {
    triedAuthorizedConnection: tried,
    activate: () => activate(injectedConnector)
  }
}
