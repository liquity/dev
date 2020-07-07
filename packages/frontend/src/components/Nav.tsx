import React from "react";
import { Box, SxProps } from "theme-ui";

export type NavProps = SxProps;

export const Nav: React.FC<NavProps> = ({ sx, children }) => (
  <Box as="nav" {...{ sx }}>
    <Box as="ul" sx={{ listStyle: "none", p: 0 }}>
      {React.Children.map(children, child => (
        <li>{child}</li>
      ))}
    </Box>
  </Box>
);
