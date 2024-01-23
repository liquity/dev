import React from "react";
import { Flex } from "theme-ui";
import { Redirect, Route, Switch, useRouteMatch } from "react-router-dom";
import { Link } from "../../../Link";
import { FilteredBondList } from "./FilteredBondList";
import { useBondView } from "../../context/BondViewContext";

export const BondList: React.FC = () => {
  const { bonds } = useBondView();
  const { url, path } = useRouteMatch();

  return (
    <>
      {bonds && (
        <Flex as="nav" mt={2}>
          <Link to={`${url}/all`} p={2}>
            All
          </Link>
          <Link to={`${url}/pending`} p={2}>
            Pending
          </Link>
          <Link to={`${url}/claimed`} p={2}>
            Claimed
          </Link>
          <Link to={`${url}/cancelled`} p={2}>
            Cancelled
          </Link>
        </Flex>
      )}

      <Switch>
        <Route exact path={path}>
          <Redirect to={`${path}/pending`} />
        </Route>
        <Route path={`${path}/:bondFilter`}>
          <FilteredBondList />
        </Route>
      </Switch>
    </>
  );
};
