import { Web3ReactProvider } from "@web3-react/core";
import { HashRouter as Router } from "react-router-dom";

import { BatchedWebSocketAugmentedWeb3Provider } from "@liquity/providers";
import { LiquityProvider } from "./hooks/LiquityContext";
import { TransactionProvider } from "./components/Transaction";
import { getConfig } from "./config";
import WalletConnector from "./pages/WalletConnector";

import { LiquityFrontend } from "./LiquityFrontend";

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
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
      <WalletConnector>
        <LiquityProvider>
          <TransactionProvider>
            <LiquityFrontend />
          </TransactionProvider>
        </LiquityProvider>
      </WalletConnector>
    </Router>
  </EthersWeb3ReactProvider>
);

export default App;
