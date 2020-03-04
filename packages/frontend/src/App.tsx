import React from "react";
import { Web3Provider } from "ethers/providers";
import { Web3ReactProvider } from "@web3-react/core";
import { Box } from "rimble-ui";

import { LiquityProvider, useLiquity, deployerAddress, useLiquityStore } from "./hooks/Liquity";
import { WalletConnector } from "./components/WalletConnector";
import { TroveView } from "./components/TroveView";
import { TroveManager } from "./components/TroveManager";
import { UserAccount } from "./components/UserAccount";
import { SystemStats } from "./components/SystemStats";
import { DeveloperTools } from "./components/DeveloperTools";
import "./App.css";

type LiquityFrontendProps = {
  loader?: React.ReactNode;
};

const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
  const { account, library, liquity } = useLiquity();
  const storeState = useLiquityStore(library, account, liquity);

  if (!storeState.loaded) {
    return <>{loader}</>;
  }

  const { balance, numberOfTroves, price, recoveryModeActive, trove } = storeState.value;

  return (
    <>
      <UserAccount {...{ balance }} />
      <SystemStats {...{ numberOfTroves, price, recoveryModeActive }} />
      {account === deployerAddress ? (
        <Box m={5}>
          <DeveloperTools {...{ liquity, price }} />
        </Box>
      ) : (
        <>
          <Box m={5}>
            <TroveView {...{ trove, price }} />
          </Box>
          <TroveManager {...{ liquity, trove, price }} />
        </>
      )}
    </>
  );
};

const App = () => (
  <div className="App">
    <header className="App-header">
      <Web3ReactProvider getLibrary={provider => new Web3Provider(provider)}>
        <LiquityProvider fallback={<WalletConnector />}>
          <LiquityFrontend loader="Loading..." />
        </LiquityProvider>
      </Web3ReactProvider>
    </header>
  </div>
);

export default App;
