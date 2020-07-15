import React from "react";
import { NavLink } from "react-router-dom";
import { Box, SxProps } from "theme-ui";

import { Nav } from "./Nav";
import { Icon } from "./Icon";
import { isElement } from "../utils/children";

const activeClassName = "active";

export const AppNavBar: React.FC<SxProps> = ({ sx, children }) => (
  <Nav
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
          alignItems: "stretch",

          ml: 7,
          pr: 9,

          color: "text",
          textDecoration: "none",

          border: 1,
          borderRight: 0,
          borderTopLeftRadius: 1,
          borderBottomLeftRadius: 1,
          borderColor: "transparent",

          "::before": {
            content: '""',
            display: "block",
            pl: 2,
            mr: 6,
            bg: "primary",
            borderTopLeftRadius: 1,
            borderBottomLeftRadius: 1,
            opacity: 0
          },

          [`&.${activeClassName}`]: {
            mr: "-1px",
            color: "primary",
            bg: "background",
            borderColor: "border",

            "::before": {
              opacity: 1
            }
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
