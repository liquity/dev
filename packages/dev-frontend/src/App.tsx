import React from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { BaseStyles, Flex, Loader, Heading, Box, Text } from "rimble-ui";

import { Decimal, Difference, Percent } from "@liquity/decimal";
import { BatchedWebSocketAugmentedWeb3Provider } from "@liquity/providers";
import { Liquity, Trove, StabilityDeposit } from "@liquity/lib";

import { LiquityProvider, useLiquity } from "./hooks/LiquityContext";
import { useLiquityStore } from "./hooks/BlockPolledLiquityStore";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider, TransactionMonitor } from "./components/Transaction";
import { TroveManager } from "./components/TroveManager";
import { UserAccount } from "./components/UserAccount";
import { SystemStats } from "./components/SystemStats";
import { StabilityDepositManager } from "./components/StabilityDepositManager";
import { RiskiestTroves } from "./components/RiskiestTroves";
import { PriceManager } from "./components/PriceManager";
import { RedemptionManager } from "./components/RedemptionManager";
import { LiquidationManager } from "./components/LiquidationManager";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";

if (process.env.REACT_APP_DEMO_MODE === "true") {
  const ethereum = new DisposableWalletProvider(
    "http://localhost:8545",
    "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
  );

  Object.assign(window, { ethereum });
}

const EthersWeb3ReactProvider: React.FC = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={provider => new BatchedWebSocketAugmentedWeb3Provider(provider)}>
      {children}
    </Web3ReactProvider>
  );
};

type LiquityFrontendProps = {
  loader?: React.ReactNode;
};

const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
  const { account, provider, liquity, contracts, contractsVersion, deploymentDate } = useLiquity();
  const storeState = useLiquityStore(provider, account, liquity);

  if (!storeState.loaded) {
    return <>{loader}</>;
  }

  // For console tinkering ;-)
  Object.assign(window, {
    provider,
    contracts,
    liquity,
    store: storeState.value,
    Liquity,
    Trove,
    StabilityDeposit,
    Decimal,
    Difference,
    Percent
  });

  const {
    blockTag,
    etherBalance,
    quiBalance,
    numberOfTroves,
    price,
    troveWithoutRewards,
    totalRedistributed,
    trove,
    total,
    deposit,
    quiInStabilityPool
  } = storeState.value;

  return (
    <>
      <Header>
        <UserAccount {...{ account, etherBalance, quiBalance }} />
      </Header>

      <Box width="862px" mx="auto">
        <Flex flexWrap="wrap" justifyItems="center">
          <Box px={3} width="500px">
            <TroveManager {...{ liquity, troveWithoutRewards, trove, price, total, quiBalance }} />
            <StabilityDepositManager {...{ liquity, deposit, trove, price, quiBalance }} />
            <RedemptionManager {...{ liquity, price, quiBalance }} />
          </Box>

          <Box px={3} width="362px">
            <SystemStats
              {...{
                numberOfTroves,
                price,
                total,
                quiInStabilityPool,
                contractsVersion,
                deploymentDate
              }}
            />
            <PriceManager {...{ liquity, price }} />
            <LiquidationManager {...{ liquity }} />
          </Box>
        </Flex>

        <RiskiestTroves
          pageSize={10}
          {...{ liquity, price, totalRedistributed, numberOfTroves, blockTag }}
        />
      </Box>

      <Footer>
        <Text>* Please note that the final user-facing application will look different.</Text>
      </Footer>

      <TransactionMonitor />
    </>
  );
};

const App = () => {
  const loader = (
    <Flex alignItems="center" justifyContent="center" height="100vh">
      <Loader m={2} size="32px" color="text" />
      <Heading>Loading...</Heading>
    </Flex>
  );

  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
      <Heading>Liquity is not yet deployed to {chainId === 1 ? "mainnet" : "this network"}.</Heading>
      <Text mt={3}>Please switch to Ropsten, Rinkeby, Kovan or Görli.</Text>
    </Flex>
  );

  return (
    <EthersWeb3ReactProvider>
      <BaseStyles>
        <WalletConnector {...{ loader }}>
          <LiquityProvider {...{ loader, unsupportedNetworkFallback }}>
            <TransactionProvider>
              <LiquityFrontend {...{ loader }} />
            </TransactionProvider>
          </LiquityProvider>
        </WalletConnector>
      </BaseStyles>
    </EthersWeb3ReactProvider>
  );
};

export default App;
