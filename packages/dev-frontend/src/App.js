import { Web3ReactProvider } from "@web3-react/core";
import { ThemeProvider } from "theme-ui";
import { HashRouter as Router } from "react-router-dom";

import { BatchedWebSocketAugmentedWeb3Provider } from "@liquity/providers";
import { LiquityProvider } from "./hooks/LiquityContext";
import { TransactionProvider } from "./components/Transaction";
import { getConfig } from "./config";
import theme from "./theme";
import WalletConnector from "./pages/WalletConnector";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";
import { LiquityFrontend } from "./LiquityFrontend";

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
}

if (process.env.REACT_APP_DEMO_MODE === "true") {
  const ethereum = new DisposableWalletProvider(
    `http://${window.location.hostname}:8545`,
    "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
  );

  Object.assign(window, { ethereum });
}

// Start pre-fetching the config
getConfig().then(config => {
  Object.assign(window, { config });
});

const EthersWeb3ReactProvider = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={provider => new BatchedWebSocketAugmentedWeb3Provider(provider)}>
      {children}
    </Web3ReactProvider>
  );
};

const App = () => (
  <EthersWeb3ReactProvider>
    <Router>
      <ThemeProvider theme={theme}>
        <WalletConnector>
          <LiquityProvider>
            <TransactionProvider>
              <LiquityFrontend />
            </TransactionProvider>
          </LiquityProvider>
        </WalletConnector>
      </ThemeProvider>
    </Router>
  </EthersWeb3ReactProvider>
);

export default App;
