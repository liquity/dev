import React from "react";
import { Flex, Box, Heading, Link } from "theme-ui";

import { LiquityLogo } from "./LiquityLogo";

export const Header: React.FC = ({ children }) => (
  <Flex
    sx={{
      px: 5,
      py: 2,
      justifyContent: "space-between",
      bg: "muted",
      borderBottom: "1px solid lightgrey"
    }}
  >
    <Flex sx={{ alignItems: "center", height: "48px" }}>
      <Link sx={{ lineHeight: "0" }} href="https://www.liquity.org">
        <LiquityLogo height="32px" />
      </Link>

      <Box sx={{ mx: 3, width: "0px", height: "100%", borderLeft: "1px solid lightgrey" }} />

      <Heading sx={{ fontWeight: "body" }}>
        Developer Interface (Beta)
        <a href="#footnote" style={{ textDecoration: "none" }}>
          *
        </a>
      </Heading>
    </Flex>
    {children}
  </Flex>
);
