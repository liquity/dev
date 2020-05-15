import React from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { BaseStyles, Flex, Loader, Heading, Box } from "rimble-ui";

import {
  Liquity,
  Trove,
  StabilityDeposit,
  BatchedWebSocketAugmentedWeb3Provider
} from "@liquity/lib";
import { Decimal, Difference, Percent } from "@liquity/lib/dist/utils";

import { LiquityProvider, useLiquity } from "./hooks/LiquityContext";
import { useLiquityStore } from "./hooks/BlockPolledLiquityStore";
import { WalletConnector } from "./components/WalletConnector";
import { ToastProvider } from "./hooks/ToastProvider";
import { TransactionProvider, TransactionMonitor } from "./components/Transaction";
import { TroveManager } from "./components/TroveManager";
import { UserAccount } from "./components/UserAccount";
import { SystemStats } from "./components/SystemStats";
import { StabilityDepositManager } from "./components/StabilityDepositManager";
import { RiskiestTroves } from "./components/RiskiestTroves";
import { PriceManager } from "./components/PriceManager";
import { RedemptionManager } from "./components/RedemptionManager";
import { LiquidationManager } from "./components/LiquidationManager";

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
      <UserAccount {...{ account, etherBalance, quiBalance }} />

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

        <RiskiestTroves pageSize={10} {...{ liquity, price, totalRedistributed, numberOfTroves }} />
      </Box>
      {
        // Some empty space to ensure content can always be scrolled up from under the
        // TransactionMonitor bar.
      }
      <Box height="72px" />

      <TransactionMonitor />
    </>
  );
};

const App = () => {
  const loader = (
    <Flex
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      width={1}
      minHeight="100vh"
    >
      <Loader m={2} size="32px" color="text" />
      <Heading>Loading...</Heading>
    </Flex>
  );

  return (
    <EthersWeb3ReactProvider>
      <BaseStyles>
        <ToastProvider>
          <WalletConnector {...{ loader }}>
            <LiquityProvider {...{ loader }}>
              <TransactionProvider>
                <LiquityFrontend {...{ loader }} />
              </TransactionProvider>
            </LiquityProvider>
          </WalletConnector>
        </ToastProvider>
      </BaseStyles>
    </EthersWeb3ReactProvider>
  );
};

export default App;
