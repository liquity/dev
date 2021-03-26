import React, { useState, useRef } from "react";
import { Button, Card, Container, Flex } from "theme-ui";
import { Icon } from "./Icon";
import { LiquityLogoSmall } from "./LiquityLogo";
import { Nav } from "./Nav";

const logoHeight = "32px";

export const SideNav: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Button variant="icon" onClick={() => setIsVisible(true)}>
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
      <Card variant="sidenav">
        <Button
          sx={{ position: "fixed", right: "25vw", m: 1 }}
          variant="icon"
          onClick={() => setIsVisible(false)}
        >
          <Icon name="times" size="2x" />
        </Button>
        <LiquityLogoSmall height={logoHeight} p={2} />
        <Flex sx={{ mr: "25vw", py: 1, ml: 2 }} onClick={() => setIsVisible(false)}>
          <Nav />
        </Flex>
      </Card>
    </Container>
  );
};
