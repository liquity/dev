import React from "react";
import { Box, SxProps } from "theme-ui";

export const Complementary: React.FC<SxProps> = ({ sx, children }) => (
  <Box as="aside" {...{ sx }}>
    {children}
  </Box>
);
