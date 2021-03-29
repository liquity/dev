import React, { useState, useRef } from "react";
import { Box, Button, Card, Container, Flex, Text } from "theme-ui";
import { Icon } from "./Icon";
import { LiquityLogoSmall } from "./LiquityLogo";
import { Link } from "./Link";

const logoHeight = "32px";

export const SideNav: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Button sx={{ display: ["flex", "none"] }} variant="icon" onClick={() => setIsVisible(true)}>
        <Icon name="bars" size="lg" />
      </Button>
    );
  }
  return (
    <Container
      variant="infoOverlay"
      ref={overlay}
      onClick={e => {
        if (e.target === overlay.current) {
          setIsVisible(false);
        }
      }}
    >
      <Flex variant="layout.sidenav">
        <Button
          sx={{ position: "fixed", right: "25vw", m: 2 }}
          variant="icon"
          onClick={() => setIsVisible(false)}
        >
          <Icon name="times" size="2x" />
        </Button>
        <LiquityLogoSmall height={logoHeight} p={2} />
        <Box as="nav" sx={{ m: 3, mt: 3, p: 0 }} onClick={() => setIsVisible(false)}>
          <Link to="/">Dashboard</Link>
          <Link to="/farm">Farm</Link>
          <Link to="/liquidation">Liquidation</Link>
          <Link to="/redemption">Redemption</Link>
        </Box>
      </Flex>
    </Container>
  );
};
