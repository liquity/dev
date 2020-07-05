import React from "react";
import { NavLink, NavLinkProps } from "react-router-dom";
import { Box, SxStyleProp } from "theme-ui";

import { Nav, NavProps } from "./Nav";
import { Icon } from "./Icon";

const activeClassName = "active";

type NavBarProps = NavProps & {
  sx?: SxStyleProp;
};

export const NavBar: React.FC<NavBarProps> = ({ sx, children, ...navProps }) => (
  <Nav
    {...navProps}
    sx={{
      fontFamily: "heading",
      fontSize: [1, 4],
      lineHeight: [1, 1.8],

      ul: {
        display: "flex",
        flexDirection: ["row", "column"],
        justifyContent: "center",

        a: {
          display: "flex",
          flexDirection: ["column", "row"],
          alignItems: "center",

          color: "text",
          textDecoration: "none",

          [`&.${activeClassName}`]: {
            color: "primary"
          },

          "&:hover": {
            color: "secondary"
          }
        }
      },

      ...sx
    }}
  >
    {React.Children.map(children, child =>
      React.isValidElement<NavLinkProps>(child) && child.type === NavLink
        ? React.cloneElement(
            child,
            { activeClassName },

            React.Children.map(child.props.children, linkChild =>
              React.isValidElement(linkChild) && linkChild.type === Icon ? (
                <Box
                  sx={{
                    width: ["60px", "46px"],
                    mt: [0, 1],
                    mr: [0, 3],
                    textAlign: "center",
                    fontSize: 4
                  }}
                >
                  {linkChild}
                </Box>
              ) : (
                linkChild
              )
            )
          )
        : child
    )}
  </Nav>
);
