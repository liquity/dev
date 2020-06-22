import React from "react";
import { Container, Flex, Box, Heading, Link } from "theme-ui";

import { LiquityLogo, LiquityLogoSmall } from "./LiquityLogo";
import { Abbreviation } from "./Abbreviation";

const logoHeight = "32px";

export const Header: React.FC = ({ children }) => (
  <Container variant="header">
    <Flex sx={{ alignItems: "center" }}>
      <Link sx={{ lineHeight: 0 }} href="https://www.liquity.org">
        <Abbreviation short={<LiquityLogoSmall height={logoHeight} />}>
          <LiquityLogo height={logoHeight} />
        </Abbreviation>
      </Link>

      <Box
        sx={{
          mx: [2, 3],
          width: "0px",
          height: "100%",
          borderLeft: ["none", "1px solid lightgrey"]
        }}
      />

      <Heading sx={{ fontWeight: "body", fontSize: [3, null, 4, null] }}>
        <Abbreviation short="Dev UI (Beta)">Developer UI (Beta)</Abbreviation>
        <Link href="#footnote" style={{ textDecoration: "none" }}>
          *
        </Link>
      </Heading>
    </Flex>

    {children}
  </Container>
);
