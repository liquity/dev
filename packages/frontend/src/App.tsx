import React from "react";
import { Web3Provider, AsyncSendable } from "ethers/providers";
import { Web3ReactProvider } from "@web3-react/core";
import { BaseStyles, Flex, Loader, Heading, Box } from "rimble-ui";

import { LiquityProvider, useLiquity, deployerAddress, useLiquityStore } from "./hooks/Liquity";
import { WalletConnector } from "./components/WalletConnector";
import { ToastProvider } from "./hooks/ToastProvider";
import { TransactionProvider, TransactionMonitor } from "./components/Transaction";
import { TroveManager } from "./components/TroveManager";
import { UserAccount } from "./components/UserAccount";
import { SystemStats } from "./components/SystemStats";
import { DeveloperTools } from "./components/DeveloperTools";
import { StabilityDepositManager } from "./components/StabilityDepositManager";
import { RiskiestTroves } from "./components/RiskiestTroves";
import { PriceManager } from "./components/PriceManager";
import { RedemptionManager } from "./components/RedemptionManager";

const EthersWeb3ReactProvider: React.FC = ({ children }) => {
  return (
    <Web3ReactProvider
      getLibrary={(provider: AsyncSendable) => {
        // Uncomment this to log requests

        // let timeOfLastRequest = new Date().getTime();
        // let numberOfRequests = 0;

        // setInterval(() => {
        //   console.log(`Requests per minute: ${numberOfRequests}`);
        //   numberOfRequests = 0;
        // }, 60000);

        // const loggedSend = <A extends any[], R, F extends (...args: A) => R>(realSend: F) => (
        //   ...args: A
        // ): R => {
        //   const now = new Date().getTime();
        //   console.log(`Time since last request: ${now - timeOfLastRequest} ms`);
        //   timeOfLastRequest = now;
        //   ++numberOfRequests;

        //   console.log(args[0]);
        //   return realSend(...args);
        // };

        // return new Web3Provider({
        //   ...provider,
        //   send: provider.send && loggedSend(provider.send),
        //   sendAsync: provider.sendAsync && loggedSend(provider.sendAsync)
        // });
        return new Web3Provider(provider);
      }}
    >
      {children}
    </Web3ReactProvider>
  );
};

type LiquityFrontendProps = {
  loader?: React.ReactNode;
};

const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
  const { account, provider, liquity } = useLiquity();
  const storeState = useLiquityStore(provider, account, liquity);

  if (!storeState.loaded) {
    return <>{loader}</>;
  }

  // For console tinkering ;-)
  (window as any).liquity = liquity;
  (window as any).store = storeState.value;

  const {
    etherBalance,
    quiBalance,
    numberOfTroves,
    price,
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
            {account === deployerAddress ? (
              <DeveloperTools {...{ liquity, price }} />
            ) : (
              <>
                <TroveManager {...{ liquity, trove, price, total, quiBalance }} />
                <StabilityDepositManager {...{ liquity, deposit, trove, price }} />
                <RedemptionManager {...{ liquity, price }} />
              </>
            )}
          </Box>
          <Box px={3} width="362px">
            <SystemStats {...{ numberOfTroves, price, total, quiInStabilityPool }} />
            <PriceManager {...{ liquity, price }} />
          </Box>
        </Flex>
        <RiskiestTroves numberOfTroves={10} {...{ liquity, price }} />
      </Box>
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
                <TransactionMonitor />
              </TransactionProvider>
            </LiquityProvider>
          </WalletConnector>
        </ToastProvider>
      </BaseStyles>
    </EthersWeb3ReactProvider>
  );
};

export default App;
