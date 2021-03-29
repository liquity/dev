import React from "react";
import { Container, Flex, Box, Link } from "theme-ui";

import { LiquityLogo, LiquityLogoSmall } from "./LiquityLogo";
import { Abbreviation } from "./Abbreviation";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

export const Header: React.FC = ({ children }) => (
  <Container variant="header">
    <Flex sx={{ alignItems: "center", flex: 1 }}>
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

      <SideNav />
      <Nav />
    </Flex>

    {children}
  </Container>
);
