import React from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Flex, Spinner, Heading, ThemeProvider, Text } from "theme-ui";

import { WalletConnector } from "@liquity/shared-react";

import { LiquityProvider } from "./hooks/LiquityContext";
import theme from "./theme";

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
}

const EthersWeb3ReactProvider: React.FC = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={provider => new Web3Provider(provider)}>
      {children}
    </Web3ReactProvider>
  );
};

const LaunchKitWizard: React.FC = () => <Text>Hello World!</Text>;

const App = () => {
  const loader = (
    <Flex sx={{ alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Spinner sx={{ m: 2, color: "text" }} size="32px" />
      <Heading>Loading...</Heading>
    </Flex>
  );

  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center"
      }}
    >
      <Heading sx={{ mb: 3 }}>
        Liquity is not yet deployed to {chainId === 1 ? "mainnet" : "this network"}.
      </Heading>
      Please switch to Ropsten, Rinkeby, Kovan or Görli.
    </Flex>
  );

  return (
    <ThemeProvider theme={theme}>
      <EthersWeb3ReactProvider>
        <WalletConnector {...{ loader }}>
          <LiquityProvider {...{ loader, unsupportedNetworkFallback }}>
            <LaunchKitWizard />
          </LiquityProvider>
        </WalletConnector>
      </EthersWeb3ReactProvider>
    </ThemeProvider>
  );
};

export default App;
