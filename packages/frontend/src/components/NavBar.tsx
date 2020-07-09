import React from "react";
import { NavLink } from "react-router-dom";
import { Box, SxProps } from "theme-ui";

import { Nav, NavProps } from "./Nav";
import { Icon } from "./Icon";
import { isElement } from "../utils/children";

const activeClassName = "active";

type NavBarProps = NavProps & SxProps;

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
      isElement(NavLink)(child)
        ? React.cloneElement(
            child,
            { activeClassName },

            React.Children.map(child.props.children, linkChild =>
              isElement(Icon)(linkChild) ? (
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
