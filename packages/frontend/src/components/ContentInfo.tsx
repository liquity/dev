import React from "react";
import { Box, SxProps } from "theme-ui";

export const ContentInfo: React.FC<SxProps> = ({ sx, children }) => (
  <Box
    as="footer"
    sx={{
      p: 7,
      whiteSpace: "nowrap",

      ...sx
    }}
  >
    {children}
  </Box>
);
