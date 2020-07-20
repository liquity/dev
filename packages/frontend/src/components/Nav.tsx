import React from "react";
import { Box, SxProps, BoxProps } from "theme-ui";

export const Nav: React.FC<SxProps & BoxProps> = ({ children, ...boxProps }) => (
  <Box as="nav" {...boxProps}>
    <Box as="ul" sx={{ listStyle: "none", p: 0 }}>
      {React.Children.map(children, child => (
        <li>{child}</li>
      ))}
    </Box>
  </Box>
);
