import React from "react";
import { NavLink } from "react-router-dom";
import { Box, SxProps, BoxProps } from "theme-ui";

import { Nav } from "./Nav";
import { Icon } from "./Icon";
import { isElement } from "../utils/children";

const activeClassName = "active";

export const AppNavBar: React.FC<SxProps & BoxProps> = ({ sx, children, ...boxProps }) => (
  <Nav
    {...boxProps}
    sx={{
      fontFamily: "heading",
      fontSize: 4,
      lineHeight: 1.8,

      ul: {
        a: {
          display: "flex",
          alignItems: "stretch",

          color: "text",
          textDecoration: "none",

          border: 1,
          borderTopLeftRadius: 1,
          borderBottomLeftRadius: 1,
          borderRight: [1, null, null, 0],
          borderTopRightRadius: [1, null, null, 0],
          borderBottomRightRadius: [1, null, null, 0],
          borderColor: "transparent",

          "::before": {
            content: '""',
            display: "block",
            pl: 2,
            mr: 3,
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
                    width: "40px",
                    mt: 1,
                    mr: 3,
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
