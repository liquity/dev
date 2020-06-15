import React from "react";
import { Flex } from "theme-ui";

export const Footer: React.FC = ({ children }) => (
  <Flex id="footnote" sx={{ mt: 4, px: 7, height: "72px", alignItems: "center", bg: "#eee" }}>
    {children}
  </Flex>
);
