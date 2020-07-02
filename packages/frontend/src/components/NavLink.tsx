import React from "react";
import {
  NavLink as ReactRouterNavLink,
  NavLinkProps as ReactRouterNavLinkProps
} from "react-router-dom";
import { Box, Flex } from "theme-ui";

import { Icon, IconProps } from "./Icon";

type NavLinkProps = Omit<ReactRouterNavLinkProps, "activeClassName"> & {
  icon: IconProps["name"];
};

export const NavLink: React.FC<NavLinkProps> = ({ children, icon, ...linkProps }) => (
  <ReactRouterNavLink activeClassName="active" {...linkProps}>
    <Flex sx={{ alignItems: "center", flexDirection: ["column", "row"] }}>
      <Box sx={{ width: ["2.4em", "2.6em"], textAlign: "center", fontSize: 4 }}>
        <Icon name={icon} />
      </Box>

      <Box sx={{ mt: "-0.15em" }}>{children}</Box>
    </Flex>
  </ReactRouterNavLink>
);
