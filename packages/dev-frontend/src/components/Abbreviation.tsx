import React from "react";
import { Box, BoxProps } from "theme-ui";

type AbbreviationProps = BoxProps & {
  short: React.ReactNode;
};

export const Abbreviation: React.FC<AbbreviationProps> = ({ children, short, ...boxProps }) => (
  <Box as="span" {...boxProps}>
    <Box as="span" sx={{ display: ["none", "unset"] }}>
      {children}
    </Box>

    <Box as="span" sx={{ display: ["unset", "none"] }}>
      {short}
    </Box>
  </Box>
);
