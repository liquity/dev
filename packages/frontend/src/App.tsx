import React from "react";
import { HashRouter as Router, Switch, Route, Redirect, NavLink } from "react-router-dom";
import { ThemeProvider } from "theme-ui";

import theme from "./theme";
import { Icon } from "./components/Icon";
import { Nav } from "./components/Nav";
import { Title } from "./components/Title";
import { BorrowPage } from "./pages/BorrowPage";
import { AppLayout } from "./layout/AppLayout";
import { AppLayout as AppLayout2 } from "./layout/AppLayout2";
import { DialogSwitch, NestedSwitch } from "./utils/routing";
import { ChangeTroveDialog } from "./dialogs/ChangeTroveDialog";
import { NotFoundRedirect, NotFoundPage } from "./pages/NotFoundPage";

const notFoundPageUrl = "/404";

const LiquityFrontend: React.FC = () => {
  const layouts = [AppLayout, AppLayout2];

  const { props: layoutProps } = (
    <>
      <Title>
        <Switch>
          <Route path="/borrow">My Trove</Route>
          <Route path="/grow">My Stability Deposit</Route>
          <Route path="/redeem">Redeem</Route>
        </Switch>
      </Title>

      <Nav>
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
      </Nav>

      <Switch>
        <Route exact path={notFoundPageUrl}>
          <NotFoundPage />
        </Route>

        <Redirect exact from="/" to="/borrow" />

        <Route path="/borrow">
          <BorrowPage />
        </Route>

        <NotFoundPage />
      </Switch>
    </>
  );

  const [, layoutIdx] = (
    document.cookie.split("; ").find(cookie => cookie.startsWith("layout=")) ?? "layout=0"
  ).split("=");

  return (
    <DialogSwitch>
      <NestedSwitch>
        <Route path="changeTrove">
          <ChangeTroveDialog />
        </Route>

        <NotFoundRedirect to={notFoundPageUrl} />
      </NestedSwitch>

      {React.createElement(layouts[parseInt(layoutIdx, 10)], layoutProps)}
    </DialogSwitch>
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
