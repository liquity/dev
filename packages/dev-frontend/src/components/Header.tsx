import React from "react";
import { Container, Flex, Box, Heading, Link, Text } from "theme-ui";

import { LiquityLogo, LiquityLogoSmall } from "./LiquityLogo";

export const Header: React.FC = ({ children }) => (
  <Container variant="header">
    <Flex sx={{ alignItems: "center" }}>
      <Link sx={{ lineHeight: 0 }} href="https://www.liquity.org">
        <LiquityLogo height="32px" sx={{ display: ["none", "block"] }} />
        <LiquityLogoSmall height="32px" sx={{ display: ["block", "none"] }} />
      </Link>

      <Box
        sx={{
          mx: [2, 3],
          width: "0px",
          height: "100%",
          borderLeft: ["none", "1px solid lightgrey"]
        }}
      />

      <Heading sx={{ fontWeight: "body", fontSize: [3, null, null, 4] }}>
        <Text as="span" sx={{ display: ["none", "inline"] }}>
          Developer UI (Beta)
        </Text>
        <Text as="span" sx={{ display: ["inline", "none"] }}>
          Dev UI (Beta)
        </Text>
        <Link href="#footnote" style={{ textDecoration: "none" }}>
          *
        </Link>
      </Heading>
    </Flex>

    {children}
  </Container>
);
