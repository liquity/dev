import React from "react";
import { Flex, SxProps } from "theme-ui";

export const Banner: React.FC<SxProps> = ({ sx, children }) => (
  <Flex
    as="header"
    sx={{
      fontSize: "38px",

      ...sx
    }}
  >
    {children}
  </Flex>
);
