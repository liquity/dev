import React from "react";
import { HashRouter as Router, Switch, Route, Redirect, NavLink } from "react-router-dom";
import { ThemeProvider } from "theme-ui";

import theme from "./theme";
import { Icon } from "./components/Icon";
import { NavBar } from "./components/NavBar";
import { Title } from "./components/Title";
import { BorrowPage } from "./pages/BorrowPage";
import { AppLayout } from "./layout/AppLayout";

const LiquityFrontend: React.FC = () => {
  return (
    <AppLayout>
      <Title>
        <Switch>
          <Route path="/borrow">My Trove</Route>
          <Route path="/grow">My Stability Deposit</Route>
          <Route path="/redeem">Redeem</Route>
        </Switch>
      </Title>

      <NavBar>
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

      <Switch>
        <Route exact path="/">
          <Redirect to="/borrow" />
        </Route>

        <Route path="/borrow">
          <BorrowPage />
        </Route>
      </Switch>
    </AppLayout>
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
