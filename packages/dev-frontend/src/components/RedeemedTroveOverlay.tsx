import React from "react";
import { Flex, Container, Card, Heading, Text } from "theme-ui";

import { Icon } from "@liquity/shared-react";

export const RedeemedTroveOverlay: React.FC = () => (
  <Container
    variant="disabledOverlay"
    sx={{
      display: "flex",
      justifyContent: "center",

      bg: "rgba(255, 255, 255, 0.75)"
    }}
  >
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",

        m: ["24px", "32px"],
        p: "16px",

        borderRadius: "8px",
        boxShadow: 2
      }}
    >
      <Flex sx={{ alignItems: "center", mx: 3 }}>
        <Icon name="info-circle" size="2x" />
        <Heading sx={{ ml: 3, fontSize: "18px" }}>Your Trove has been redeemed</Heading>
      </Flex>

      <Text sx={{ fontSize: 2, p: 0 }}>
        Please reclaim your remaining collateral before opening a new Trove
      </Text>
    </Card>
  </Container>
);
