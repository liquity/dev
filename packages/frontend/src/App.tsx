import React from "react";
import { HashRouter as Router, Switch, Route, Redirect, NavLink } from "react-router-dom";
import { ThemeProvider, Box, Flex } from "theme-ui";

import theme from "./theme";
import {
  displayOnNonMobile,
  displayOnWide,
  displayOnNonWide,
  breakOnWide
} from "./utils/breakpoints";
import { Icon } from "./components/Icon";
import { NavBar } from "./components/NavBar";
import { AccessibleLiquityLogo } from "./components/AccessibleLiquityLogo";
import { Banner } from "./components/Banner";
import { Title } from "./components/Title";
import { ContentInfo } from "./components/ContentInfo";
import { Main } from "./components/Main";
import { BorrowPage } from "./pages/BorrowPage";
import { Complementary } from "./components/Complementary";
import { WalletDropdown } from "./components/WalletDropdown";
import { MoreInfoButton } from "./components/MoreInfoButton";
import { WalletBalance } from "./components/WalletBalance";
import { SystemStatsCard } from "./components/SystemStatsCard";
import { PriceFeedsCard } from "./components/PriceFeedsCard";

const LiquityFrontend: React.FC = () => {
  return (
    <Flex
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%"
      }}
    >
      <Banner sx={{ position: "relative" }}>
        <AccessibleLiquityLogo />

        <Title sx={{ position: ["absolute", "unset"], top: "100%", ml: [0, "0.75em"] }}>
          <Switch>
            <Route path="/borrow">My Trove</Route>
            <Route path="/grow">My Stability Deposit</Route>
            <Route path="/redeem">Redeem</Route>
          </Switch>
        </Title>
      </Banner>

      <Flex sx={{ flexGrow: 1 }}>
        <Flex sx={{ flexDirection: "column" }}>
          <NavBar
            sx={{
              flexGrow: 1,

              position: ["absolute", "unset"],
              top: 5,
              left: 8,
              right: 8,

              mx: 7
            }}
          >
            <NavLink to="/borrow">
              <Icon name="hands-helping" />
              Borrow
            </NavLink>

            <NavLink to="/grow">
              <Icon name="seedling" />
              Grow
            </NavLink>

            <NavLink to="/redeem">
              <Icon name="retweet" />
              Redeem
            </NavLink>
          </NavBar>

          <ContentInfo sx={{ ...displayOnNonMobile }}>© Liquity.org | 2020</ContentInfo>
        </Flex>

        <Box sx={{ flexGrow: 1, minHeight: ["440px", "605px"] }}>
          <Main
            sx={{
              position: ["unset", "absolute"],
              top: 0,
              left: [null, "220px", null, "320px"],
              right: [null, 0, null, "320px"],
              height: "100%"
            }}
          >
            <Switch>
              <Route exact path="/">
                <Redirect to="/borrow" />
              </Route>

              <Route path="/borrow">
                <BorrowPage />
              </Route>
            </Switch>
          </Main>
        </Box>

        <Box
          sx={{
            position: "absolute",

            ...breakOnWide({
              right: [4, 7],
              top: [4, 7]
            })
          }}
        >
          <Complementary sx={{ ...displayOnNonWide }}>
            <MoreInfoButton />
          </Complementary>

          <Complementary sx={{ ...displayOnWide }}>
            <Flex
              sx={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                width: "360px"
              }}
            >
              <WalletDropdown />
              <WalletBalance />
            </Flex>

            <Box sx={{ position: "absolute", right: 0 }}>
              <SystemStatsCard sx={{ mt: 8 }} />
              <PriceFeedsCard sx={{ mt: 8, ml: 7 }} />
            </Box>
          </Complementary>
        </Box>
      </Flex>
    </Flex>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <LiquityFrontend />
      </Router>
    </ThemeProvider>
  );
};

export default App;
