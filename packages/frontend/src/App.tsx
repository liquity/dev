import React from "react";
import { Web3Provider } from "ethers/providers";
import { Web3ReactProvider, useWeb3React } from "@web3-react/core";
import { Box, Button } from "rimble-ui";

import { Decimal } from "@liquity/lib/dist/utils"; // TODO: should not have to put dist, investigate
import { LiquityProvider, useLiquity } from "./hooks/Liquity";
import { WalletConnector } from "./components/WalletConnector";
import { CurrentTrove } from "./components/TroveView";
import "./App.css";

const LiquityFrontend = () => {
  const web3 = useWeb3React<Web3Provider>();
  const liquity = useLiquity();

  return (
    <div className="App">
      <header className="App-header">
        <WalletConnector />
        {web3.active ? (
          <Box m={5}>
            <CurrentTrove />
          </Box>
        ) : null}
        {liquity ? (
          <Button
            onClick={() =>
              liquity?.createTrove({ collateral: Decimal.from(100), debt: Decimal.from(0) })
            }
          >
            Add collateral
          </Button>
        ) : null}
      </header>
    </div>
  );
};

const App = () => (
  <Web3ReactProvider getLibrary={provider => new Web3Provider(provider)}>
    <LiquityProvider>
      <LiquityFrontend />
    </LiquityProvider>
  </Web3ReactProvider>
);

export default App;
