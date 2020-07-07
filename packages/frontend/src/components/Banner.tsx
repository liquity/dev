import React from "react";
import { Flex, SxProps } from "theme-ui";

export const Banner: React.FC<SxProps> = ({ sx, children }) => (
  <Flex
    as="header"
    sx={{
      p: [5, 7],
      fontSize: "38px",

      ...sx
    }}
  >
    {children}
  </Flex>
);
