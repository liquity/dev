import React from "react";
import { Web3Provider } from "ethers/providers";
import { Web3ReactProvider, useWeb3React } from "@web3-react/core";
import { Box } from "rimble-ui";

import { LiquityProvider, useLiquity } from "./hooks/Liquity";
import { WalletConnector } from "./components/WalletConnector";
import { CurrentTrove } from "./components/TroveView";
import { TroveManager } from "./components/TroveManager";
import { AccountBalance } from "./components/AccountBalance";
import "./App.css";

const LiquityFrontend = () => {
  const web3 = useWeb3React<Web3Provider>();
  const liquity = useLiquity();

  if (!web3.account || !web3.library || !liquity) {
    return <WalletConnector />;
  }

  return (
    <>
      <AccountBalance provider={web3.library} account={web3.account} />
      <Box m={5}>
        <CurrentTrove liquity={liquity} />
      </Box>
      <TroveManager liquity={liquity} />
    </>
  );
};

const App = () => (
  <div className="App">
    <header className="App-header">
      <Web3ReactProvider getLibrary={provider => new Web3Provider(provider)}>
        <LiquityProvider>
          <LiquityFrontend />
        </LiquityProvider>
      </Web3ReactProvider>
    </header>
  </div>
);

export default App;
