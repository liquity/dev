import { useState, useEffect } from "react";
import { useWeb3React } from "@web3-react/core";

import { injectedConnector } from "../connectors/injectedConnector";

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

export function useAuthorizedConnection(): boolean {
  const { activate, active } = useWeb3React<unknown>();
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const tryToActivateIfAuthorized = async () => {
      try {
        if (await injectedConnector.isAuthorized()) {
          await activate(injectedConnector, undefined, true);
        } else {
          throw new Error("Unauthorized");
        }
      } catch {
        setTried(true);
      }
    };
    tryToActivateIfAuthorized();
  }, [activate]);

  useEffect(() => {
    if (active) {
      setTried(true);
    }
  }, [active]);

  return tried;
}
