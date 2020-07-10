import React from "react";
import { Switch, Route, useRouteMatch, useParams, LinkProps, Link } from "react-router-dom";

import { isElement } from "./children";

export const NestedSwitch: React.FC = ({ children }) => {
  const { url } = useRouteMatch();

  return (
    <Switch>
      {React.Children.map(children, child =>
        isElement(Route)(child)
          ? React.cloneElement(child, { path: `${url}/${child.props.path}` })
          : child
      )}
    </Switch>
  );
};

export const RelativeLink: React.FC<LinkProps> = ({ to, children, ...linkProps }) => {
  const { url } = useRouteMatch();

  return (
    <Link to={`${url}/${to}`} {...linkProps}>
      {children}
    </Link>
  );
};

type DialogRouteParams = { basePage: string };

export const DialogSwitch: React.FC = ({ children }) => {
  const [firstChild, ...restOfChildren] = React.Children.toArray(children);

  return (
    <Switch>
      <Route path="/:basePage+/dialog">{firstChild}</Route>

      {restOfChildren}
    </Switch>
  );
};

export const useDialogBasePage = () => useParams<DialogRouteParams>().basePage;
