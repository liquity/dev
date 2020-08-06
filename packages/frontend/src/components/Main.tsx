import React from "react";
import { Flex, SxProps } from "theme-ui";

export const Main: React.FC<SxProps> = ({ sx, children }) => (
  <Flex
    as="main"
    sx={{
      flexDirection: "column",
      alignItems: ["stretch", "center"],
      justifyContent: ["start", "center"],

      p: 5,

      ...sx
    }}
  >
    {children}
  </Flex>
);
