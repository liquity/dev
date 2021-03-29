import React from "react";
import { Container, Flex } from "theme-ui";

import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

export const Header: React.FC = ({ children }) => (
  <Container variant="header">
    <Flex sx={{ alignItems: "center", flex: 1 }}>
      <SideNav />
      <Nav />
    </Flex>
    {children}
  </Container>
);
