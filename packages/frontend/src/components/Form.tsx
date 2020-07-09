import React from "react";
import { Flex, SxProps } from "theme-ui";

import { displayOnMobile } from "../utils/breakpoints";

export const Form: React.FC<SxProps> = ({ sx, children }) => (
  <Flex
    as="form"
    sx={{
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: ["stretch", "center"],

      position: "relative",
      zIndex: 0,
      height: "100%",

      "::before": {
        ...displayOnMobile,
        content: '""'
      },

      ...sx
    }}
  >
    {children}
  </Flex>
);
