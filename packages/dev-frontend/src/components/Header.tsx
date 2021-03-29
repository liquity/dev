import React from "react";
import { Container, Flex, Box } from "theme-ui";

import { LiquityLogo } from "./LiquityLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

export const Header: React.FC = ({ children }) => (
  <Container variant="header">
    <Flex sx={{ alignItems: "center", flex: 1 }}>
      <LiquityLogo height={logoHeight} />

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
