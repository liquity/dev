import React from "react";
import { Flex, Box, Heading, Link } from "rimble-ui";

import { LiquityLogo } from "./LiquityLogo";

export const Header: React.FC = ({ children }) => (
  <Flex
    px={5}
    py={2}
    justifyContent="space-between"
    bg="near-white"
    borderBottom="1px solid lightgrey"
  >
    <Flex alignItems="center" height="48px">
      <Link lineHeight="0" href="https://www.liquity.org">
        <LiquityLogo height="32px" />
      </Link>

      <Box mx={3} width="0px" height="100%" borderLeft="1px solid lightgrey" />

      <Heading fontWeight={2}>
        Developer Interface (Beta)
        <a href="#footnote" style={{ textDecoration: "none", color: "#1542CD" }}>
          *
        </a>
      </Heading>
    </Flex>
    {children}
  </Flex>
);
