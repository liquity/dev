import React from "react";
import { Box, BoxOwnProps } from "theme-ui";

export type NavProps = Omit<BoxOwnProps, "as">;

export const Nav: React.FC<NavProps> = ({ children, ...boxProps }) => (
  <Box as="nav" {...boxProps}>
    <Box as="ul" sx={{ listStyle: "none", p: 0 }}>
      {React.Children.map(children, child => (
        <li>{child}</li>
      ))}
    </Box>
  </Box>
);
