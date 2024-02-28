import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
import { mainnet, goerli, sepolia, localhost } from "wagmi/chains";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { Flex, Heading, ThemeUIProvider, Paragraph, Link } from "theme-ui";

import { LiquityProvider } from "./hooks/LiquityContext";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider } from "./components/Transaction";
import { Icon } from "./components/Icon";
import { getConfig } from "./config";
import theme from "./theme";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";
import { LiquityFrontend } from "./LiquityFrontend";
import { AppLoader } from "./components/AppLoader";
import { useAsyncValue } from "./hooks/AsyncValue";

const isDemoMode = import.meta.env.VITE_APP_DEMO_MODE === "true";

if (isDemoMode) {
  const ethereum = new DisposableWalletProvider(
    import.meta.env.VITE_APP_RPC_URL || `http://${window.location.hostname || "localhost"}:8545`,
    "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
  );

  Object.assign(window, { ethereum });
}

// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

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

    <Paragraph sx={{ mb: 3 }}>Please change your network to Görli or Sepolia.</Paragraph>

    <Paragraph>
      If you'd like to use the Liquity Protocol on mainnet, please pick a frontend{" "}
      <Link href="https://www.liquity.org/frontend">
        here <Icon name="external-link-alt" size="xs" />
      </Link>
      .
    </Paragraph>
  </Flex>
);

const UnsupportedNetworkFallback: React.FC = () => (
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
      <Icon name="exclamation-triangle" /> Liquity is not supported on this network.
    </Heading>
    Please switch to mainnet, Görli or Sepolia.
  </Flex>
);

const queryClient = new QueryClient();

const App = () => {
  const config = useAsyncValue(getConfig);
  const loader = <AppLoader />;

  return (
    <ThemeUIProvider theme={theme}>
      {config.loaded && (
        <WagmiProvider
          config={createConfig(
            getDefaultConfig({
              appName: "Liquity",

              chains:
                isDemoMode || import.meta.env.MODE === "test"
                  ? [localhost]
                  : config.value.testnetOnly
                  ? [goerli, sepolia]
                  : [mainnet, goerli, sepolia],

              walletConnectProjectId: config.value.walletConnectProjectId,

              transports: {
                [mainnet.id]: fallback([
                  ...(config.value.infuraApiKey
                    ? [http(`https://mainnet.infura.io/v3/${config.value.infuraApiKey}`)]
                    : []),
                  ...(config.value.alchemyApiKey
                    ? [http(`https://eth-mainnet.g.alchemy.com/v2/${config.value.alchemyApiKey}`)]
                    : []),
                  http()
                ])
              }
            })
          )}
        >
          <QueryClientProvider client={queryClient}>
            <ConnectKitProvider options={{ hideBalance: true }}>
              <WalletConnector loader={loader}>
                <LiquityProvider
                  loader={loader}
                  unsupportedNetworkFallback={<UnsupportedNetworkFallback />}
                  unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
                >
                  <TransactionProvider>
                    <LiquityFrontend loader={loader} />
                  </TransactionProvider>
                </LiquityProvider>
              </WalletConnector>
            </ConnectKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      )}
    </ThemeUIProvider>
  );
};

export default App;
