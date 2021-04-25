import React from "react";
import { Flex, Container } from "theme-ui";
import { Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@liquity/lib-base";
import { LiquityStoreProvider } from "@liquity/lib-react";

import { useLiquity } from "./hooks/LiquityContext";
import { TransactionMonitor } from "./components/Transaction";
import { UserAccount } from "./components/UserAccount";

import { PageSwitcher } from "./pages/PageSwitcher";
import { Farm } from "./pages/Farm";
import { RiskyTrovesPage } from "./pages/RiskyTrovesPage";
import { RedemptionPage } from "./pages/RedemptionPage";

import { TroveViewProvider } from "./components/Trove/context/TroveViewProvider";
import { StabilityViewProvider } from "./components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "./components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "./components/Farm/context/FarmViewProvider";
import Loader from "./components/Loader";
import Header from "./components/Header";
import Body from "./components/Body";

export const LiquityFrontend = () => {
  const { account, provider, liquity } = useLiquity();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    liquity,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <LiquityStoreProvider loader={Loader} store={liquity.store}>
      <TroveViewProvider>
        <StabilityViewProvider>
          <StakingViewProvider>
            <FarmViewProvider>
              <Header>
                <UserAccount />
              </Header>

              <Body>
                <Switch>
                  <Route path="/" exact>
                    <PageSwitcher />
                  </Route>
                  <Route path="/stability-pool">
                    <div>Stability Pool</div>
                  </Route>
                  <Route path="/stake">
                    <div>Stake</div>
                  </Route>
                  <Route path="/liquidation">
                    <div>liquidation</div>
                  </Route>
                </Switch>
              </Body>
            </FarmViewProvider>
          </StakingViewProvider>
        </StabilityViewProvider>
      </TroveViewProvider>
      <TransactionMonitor />
    </LiquityStoreProvider>
  );
};
