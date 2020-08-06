import React from "react";
import { SxProps } from "theme-ui";

import { Nav } from "./Nav";

export const DialogNavBar: React.FC<SxProps> = ({ sx, children }) => (
  <Nav
    sx={{
      ul: {
        display: "flex",
        lineHeight: 1,
        m: [5, 7],

        a: {
          color: "text",

          "&:hover": {
            color: "secondary"
          }
        }
      },

      ...sx
    }}
  >
    {children}
  </Nav>
);
