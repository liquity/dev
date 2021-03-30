import React from "react";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { Container, Flex, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useLiquity } from "../hooks/LiquityContext";

import { LiquityLogo } from "./LiquityLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

const select = ({ frontend }: LiquityStoreState) => ({
  frontend
});

export const Header: React.FC = ({ children }) => {
  const {
    config: { frontendTag }
  } = useLiquity();
  const { frontend } = useLiquitySelector(select);
  const isFrontendRegistered = frontendTag === AddressZero || frontend.status === "registered";

  return (
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
        {isFrontendRegistered && (
          <>
            <SideNav />
            <Nav />
          </>
        )}
      </Flex>

      {children}
    </Container>
  );
};
