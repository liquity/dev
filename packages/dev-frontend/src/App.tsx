import React from "react";
import { Web3ReactProvider, createWeb3ReactRoot } from "@web3-react/core";
import { Flex, Spinner, Heading, ThemeProvider, Paragraph, Link } from "theme-ui";
import Web3ReactManager from "./components/Web3ReactManager"
import { LiquityProvider } from "./hooks/LiquityContext";
import { TransactionProvider } from "./components/Transaction";
import { Icon } from "./components/Icon";
import { getConfig } from "./config";
import theme from "./theme";
import { ethers } from 'ethers'

import { LiquityFrontend } from "./LiquityFrontend";


// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

const Web3ProviderNetwork = createWeb3ReactRoot('NETWORK')

function getLibrary(provider: any) {
  const library = new ethers.providers.Web3Provider(provider)
  library.pollingInterval = 10000
  return library
}

const UnsupportedMainnetFallback: React.FC = () => (
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
      <Icon name="exclamation-triangle" /> This app is for testing purposes only.
    </Heading>

    <Paragraph sx={{ mb: 3 }}>
      Please change your network to Ropsten, Rinkeby, Kovan or Görli.
    </Paragraph>

    <Paragraph>
      If you'd like to use the Liquity Protocol on mainnet, please pick a frontend{" "}
      <Link href="https://www.liquity.org/frontend">
        here <Icon name="external-link-alt" size="xs" />
      </Link>
      .
    </Paragraph>
  </Flex>
);

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
        <Icon name="exclamation-triangle" /> Liquity is not yet deployed to{" "}
        {chainId === 1 ? "mainnet" : "this network"}.
      </Heading>
      Please switch to Ropsten, Rinkeby, Kovan or Görli.
    </Flex>
  );

  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <Web3ProviderNetwork getLibrary={getLibrary}>
        <Web3ReactManager>
          <ThemeProvider theme={theme}>
              <LiquityProvider
                loader={loader}
                unsupportedNetworkFallback={unsupportedNetworkFallback}
                unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
              >
                <TransactionProvider>
                  <LiquityFrontend loader={loader} />
                </TransactionProvider>
              </LiquityProvider>
          </ThemeProvider>
        </Web3ReactManager>
      </Web3ProviderNetwork>
    </Web3ReactProvider>
  );
};

export default App;
