import React, { useContext } from "react";
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

export const RelativeLink: React.FC<LinkProps> = ({ to, style, children, ...linkProps }) => {
  const { url } = useRouteMatch();

  return (
    <Link
      to={`${url}/${to}`}
      {...linkProps}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "stretch",
        textDecoration: "none",

        ...style
      }}
    >
      {children}
    </Link>
  );
};

type DialogRouteParams = { basePage: string };

const DialogBasePageContext = React.createContext<string | undefined>(undefined);

const DialogBasePageProvider: React.FC = ({ children }) => {
  const { basePage } = useParams<DialogRouteParams>();

  return (
    <DialogBasePageContext.Provider value={basePage}>{children}</DialogBasePageContext.Provider>
  );
};

export const DialogSwitch: React.FC = ({ children }) => {
  const [firstChild, ...restOfChildren] = React.Children.toArray(children);

  return (
    <Switch>
      <Route path="/:basePage+/dialog">
        <DialogBasePageProvider>{firstChild}</DialogBasePageProvider>
      </Route>

      {restOfChildren}
    </Switch>
  );
};

export const useDialogBasePage = () => useContext(DialogBasePageContext);
